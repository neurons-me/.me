use std::collections::BTreeSet;

use super::{IntoPath, Kernel, Value};

pub(super) fn extract_expression_refs(expression: &str) -> BTreeSet<String> {
    tokenize_eval_expression(expression)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|token| match token {
            EvalToken::Identifier(label) => Some(label),
            _ => None,
        })
        .collect()
}

pub(super) fn evaluate_expression(
    kernel: &Kernel,
    eval_scope: &[String],
    raw: &str,
) -> Option<Value> {
    let tokens = tokenize_eval_expression(raw)?;
    if tokens.is_empty() {
        return None;
    }

    let mut output = Vec::new();
    let mut ops = Vec::new();
    let mut previous = EvalPrevious::Start;

    for token in tokens {
        match token {
            EvalToken::Literal(_) | EvalToken::Identifier(_) => {
                output.push(token);
                previous = EvalPrevious::Value;
            }
            EvalToken::LParen => {
                ops.push(EvalToken::LParen);
                previous = EvalPrevious::LParen;
            }
            EvalToken::RParen => {
                let mut found_lparen = false;
                while let Some(top) = ops.pop() {
                    if top == EvalToken::LParen {
                        found_lparen = true;
                        break;
                    }
                    output.push(top);
                }
                if !found_lparen {
                    return None;
                }
                previous = EvalPrevious::RParen;
            }
            EvalToken::Op(mut op) => {
                let unary_position = matches!(
                    previous,
                    EvalPrevious::Start | EvalPrevious::Op | EvalPrevious::LParen
                );
                let invalid_not_position =
                    op == "!" && matches!(previous, EvalPrevious::Value | EvalPrevious::RParen);
                let invalid_binary_position = op != "!" && op != "-" && unary_position;

                if op == "-" && unary_position {
                    op = "u-".to_string();
                } else if invalid_not_position || invalid_binary_position {
                    return None;
                }

                while let Some(EvalToken::Op(top)) = ops.last() {
                    let current_precedence = op_precedence(&op)?;
                    let top_precedence = op_precedence(top)?;
                    let should_pop = if op == "u-" || op == "!" {
                        current_precedence < top_precedence
                    } else {
                        current_precedence <= top_precedence
                    };
                    if !should_pop {
                        break;
                    }
                    output.push(ops.pop()?);
                }
                ops.push(EvalToken::Op(op));
                previous = EvalPrevious::Op;
            }
        }
    }

    if matches!(
        previous,
        EvalPrevious::Start | EvalPrevious::Op | EvalPrevious::LParen
    ) {
        return None;
    }

    while let Some(top) = ops.pop() {
        if top == EvalToken::LParen {
            return None;
        }
        output.push(top);
    }

    eval_rpn(kernel, eval_scope, output)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EvalPrevious {
    Start,
    Value,
    Op,
    LParen,
    RParen,
}

#[derive(Debug, Clone, PartialEq)]
enum EvalToken {
    Literal(Value),
    Identifier(String),
    Op(String),
    LParen,
    RParen,
}

fn tokenize_eval_expression(raw: &str) -> Option<Vec<EvalToken>> {
    let chars = raw.trim().chars().collect::<Vec<_>>();
    let mut tokens = Vec::new();
    let mut index = 0;

    while index < chars.len() {
        let ch = chars[index];
        if ch.is_whitespace() {
            index += 1;
            continue;
        }

        if ch == '(' {
            tokens.push(EvalToken::LParen);
            index += 1;
            continue;
        }
        if ch == ')' {
            tokens.push(EvalToken::RParen);
            index += 1;
            continue;
        }

        if index + 1 < chars.len() {
            let two = [chars[index], chars[index + 1]].iter().collect::<String>();
            if matches!(two.as_str(), ">=" | "<=" | "==" | "!=" | "&&" | "||") {
                tokens.push(EvalToken::Op(two));
                index += 2;
                continue;
            }
        }

        if matches!(ch, '+' | '-' | '*' | '/' | '%' | '<' | '>' | '!') {
            tokens.push(EvalToken::Op(ch.to_string()));
            index += 1;
            continue;
        }

        if ch.is_ascii_digit()
            || (ch == '.' && chars.get(index + 1).is_some_and(|c| c.is_ascii_digit()))
        {
            let (value, next_index) = scan_number(&chars, index)?;
            tokens.push(EvalToken::Literal(Value::Number(value)));
            index = next_index;
            continue;
        }

        if ch.is_ascii_alphabetic() || ch == '_' {
            let (identifier, next_index) = scan_identifier(&chars, index)?;
            match identifier.as_str() {
                "true" => tokens.push(EvalToken::Literal(Value::Bool(true))),
                "false" => tokens.push(EvalToken::Literal(Value::Bool(false))),
                "null" | "undefined" => tokens.push(EvalToken::Literal(Value::Null)),
                _ => tokens.push(EvalToken::Identifier(identifier)),
            }
            index = next_index;
            continue;
        }

        return None;
    }

    Some(tokens)
}

fn scan_number(chars: &[char], start: usize) -> Option<(f64, usize)> {
    let mut index = start;
    while chars.get(index).is_some_and(|ch| ch.is_ascii_digit()) {
        index += 1;
    }
    if chars.get(index) == Some(&'.') {
        index += 1;
        while chars.get(index).is_some_and(|ch| ch.is_ascii_digit()) {
            index += 1;
        }
    }
    if matches!(chars.get(index), Some('e' | 'E')) {
        index += 1;
        if matches!(chars.get(index), Some('+' | '-')) {
            index += 1;
        }
        let exp_start = index;
        while chars.get(index).is_some_and(|ch| ch.is_ascii_digit()) {
            index += 1;
        }
        if index == exp_start {
            return None;
        }
    }

    let value = chars[start..index]
        .iter()
        .collect::<String>()
        .parse::<f64>()
        .ok()?;
    value.is_finite().then_some((value, index))
}

fn scan_identifier(chars: &[char], start: usize) -> Option<(String, usize)> {
    let mut index = start;
    let mut bracket_depth = 0_u32;
    let mut quote = None;

    while index < chars.len() {
        let ch = chars[index];
        if let Some(q) = quote {
            if ch == q {
                quote = None;
            }
            index += 1;
            continue;
        }

        if bracket_depth > 0 {
            if ch == '"' || ch == '\'' {
                quote = Some(ch);
            } else if ch == '[' {
                bracket_depth += 1;
            } else if ch == ']' {
                bracket_depth -= 1;
            }
            index += 1;
            continue;
        }

        if ch.is_ascii_alphanumeric() || ch == '_' || ch == '.' {
            index += 1;
            continue;
        }
        if ch == '[' {
            bracket_depth += 1;
            index += 1;
            continue;
        }
        break;
    }

    if bracket_depth != 0 || quote.is_some() || index == start {
        return None;
    }
    Some((chars[start..index].iter().collect(), index))
}

fn op_precedence(op: &str) -> Option<u8> {
    match op {
        "u-" | "!" => Some(7),
        "*" | "/" | "%" => Some(6),
        "+" | "-" => Some(5),
        "<" | "<=" | ">" | ">=" => Some(4),
        "==" | "!=" => Some(3),
        "&&" => Some(2),
        "||" => Some(1),
        _ => None,
    }
}

fn eval_rpn(kernel: &Kernel, eval_scope: &[String], tokens: Vec<EvalToken>) -> Option<Value> {
    let mut stack = Vec::new();

    for token in tokens {
        match token {
            EvalToken::Literal(value) => stack.push(value),
            EvalToken::Identifier(label) => {
                stack.push(resolve_eval_token(kernel, &label, eval_scope)?)
            }
            EvalToken::Op(op) if op == "u-" || op == "!" => {
                let value = stack.pop()?;
                if op == "u-" {
                    stack.push(Value::Number(-to_finite_number(&value)?));
                } else {
                    stack.push(Value::Bool(!truthy(&value)));
                }
            }
            EvalToken::Op(op) => {
                let right = stack.pop()?;
                let left = stack.pop()?;
                stack.push(apply_binary_op(&left, &op, &right)?);
            }
            EvalToken::LParen | EvalToken::RParen => return None,
        }
    }

    if stack.len() != 1 {
        return None;
    }
    match stack.pop()? {
        Value::Number(number) if number.is_finite() => Some(Value::Number(number)),
        Value::Bool(value) => Some(Value::Bool(value)),
        _ => None,
    }
}

fn resolve_eval_token(kernel: &Kernel, label: &str, eval_scope: &[String]) -> Option<Value> {
    let token_path = label.into_path().ok()?;
    let relative_path = eval_scope
        .iter()
        .cloned()
        .chain(token_path.iter().cloned())
        .collect::<Vec<_>>();

    kernel
        .read(relative_path)
        .cloned()
        .or_else(|| kernel.read(token_path).cloned())
}

fn apply_binary_op(left: &Value, op: &str, right: &Value) -> Option<Value> {
    if op == "&&" || op == "||" {
        return Some(Value::Bool(if op == "&&" {
            truthy(left) && truthy(right)
        } else {
            truthy(left) || truthy(right)
        }));
    }

    if op == "==" || op == "!=" {
        let equal = loose_equal(left, right);
        return Some(Value::Bool(if op == "==" { equal } else { !equal }));
    }

    if matches!(op, "<" | "<=" | ">" | ">=") {
        let left = to_finite_number(left)?;
        let right = to_finite_number(right)?;
        return Some(Value::Bool(match op {
            "<" => left < right,
            "<=" => left <= right,
            ">" => left > right,
            ">=" => left >= right,
            _ => unreachable!(),
        }));
    }

    let left = to_finite_number(left)?;
    let right = to_finite_number(right)?;
    let out = match op {
        "+" => left + right,
        "-" => left - right,
        "*" => left * right,
        "/" => left / right,
        "%" => left % right,
        _ => return None,
    };
    out.is_finite().then_some(Value::Number(out))
}

fn to_finite_number(value: &Value) -> Option<f64> {
    match value {
        Value::Number(number) if number.is_finite() => Some(*number),
        Value::String(value) => value.parse::<f64>().ok().filter(|n| n.is_finite()),
        _ => None,
    }
}

fn truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(value) => *value,
        Value::Number(value) => *value != 0.0 && value.is_finite(),
        Value::String(value) => !value.is_empty(),
        Value::Array(value) => !value.is_empty(),
        Value::Object(value) => !value.is_empty(),
        Value::Pointer(_) | Value::Identity(_) => true,
    }
}

fn loose_equal(left: &Value, right: &Value) -> bool {
    if left == right {
        return true;
    }
    match (to_finite_number(left), to_finite_number(right)) {
        (Some(left), Some(right)) => left == right,
        _ => false,
    }
}
