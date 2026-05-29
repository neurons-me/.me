//Generate a boolean indicating whether the Option contains a value.
pub fn have<T>(option: &Option<T>) -> bool {
    option.is_some()
}   
//Generate a boolean indicating whether the Result is Ok.
pub fn have_result<T, E>(result: &Result<T, E>) -> bool {
    result.is_ok()
}   

//Generate a boolean indicating whether a string slice is non-empty.
pub fn have_str(s: &str) -> bool {
    !s.is_empty()
}   

//Generate a boolean indicating whether a vector is non-empty.
pub fn have_vec<T>(vec: &Vec<T>) -> bool {
    !vec.is_empty()
}   

//Generate a boolean indicating whether a slice is non-empty.
pub fn have_slice<T>(slice: &[T]) -> bool {
    !slice.is_empty()
}   

//Generate a boolean indicating whether a hashmap is non-empty.
use std::collections::HashMap;
pub fn have_hashmap<K, V>(map: &HashMap<K, V>) -> bool {
    !map.is_empty()
}

//Generate a boolean indicating whether a set is non-empty.
use std::collections::HashSet;
pub fn have_hashset<T>(set: &HashSet<T>) -> bool {
    !set.is_empty()
}   

//Generate a boolean indicating whether an iterator has any elements.
pub fn have_iterator<T, I>(iter: I) -> bool
where
    I: IntoIterator<Item = T>,
{   
    iter.into_iter().next().is_some()
}   
//Generate a boolean indicating whether a string contains a substring.
pub fn have_substr(s: &str, substr: &str) -> bool {
    s.contains(substr)
}       
//Generate a boolean indicating whether a number is non-zero.
pub fn have_number<T>(num: T) -> bool
where
    T: PartialEq + From<u8>,
{   
    num != T::from(0u8)
}

//Generate a boolean indicating whether a boolean is true.
pub fn have_bool(b: bool) -> bool {
    b
}   

//Generate a boolean indicating whether a reference is non-null.
pub fn have_ref<T>(r: &Option<&T>) -> bool {
    r.is_some()
}   

//Generate a boolean indicating whether a file path exists.
use std::path::Path;
pub fn have_path(path: &Path) -> bool {
    path.exists()
}       

//Generate a boolean indicating whether a vector contains a specific element.
pub fn have_vec_elem<T>(vec: &Vec<T>, elem: &T) -> bool
where
    T: PartialEq,
{
    vec.contains(elem)
}   

//Generate a boolean indicating whether a slice contains a specific element.
pub fn have_slice_elem<T>(slice: &[T], elem: &T) -> bool
where
    T: PartialEq,
{
    slice.contains(elem)
}       

//Generate a boolean indicating whether a string starts with a specific prefix.
pub fn have_str_prefix(s: &str, prefix: &str) -> bool {
    s.starts_with(prefix)           
}

//Generate a boolean indicating whether a string ends with a specific suffix.
pub fn have_str_suffix(s: &str, suffix: &str) -> bool {
    s.ends_with(suffix)
}   

//Generate a boolean indicating whether two references point to the same object.
pub fn have_same_ref<T>(a: &T, b: &T) -> bool
where
    T: std::cmp::PartialEq,
{
    std::ptr::eq(a, b)
}   
//Generate a boolean indicating whether an Option contains a specific value.
pub fn have_option_value<T>(option: &Option<T>, value: &T) -> bool
where           
    T: PartialEq,
{
    match option {
        Some(v) => v == value,
        None => false,
    }
}

//Generate a boolean indicating whether a Result contains a specific Ok value.
pub fn have_result_value<T, E>(result: &Result<T, E>, value: &T) -> bool
where
    T: PartialEq,
{
    match result {          
        Ok(v) => v == value,
        Err(_) => false,
    }
}   

//Generate a boolean indicating whether a character is present in a string.
pub fn have_char_in_str(s: &str, c: char) -> bool {
    s.contains(c)   
}

//Generate a boolean indicating whether two slices have any common elements.
pub fn have_common_elements<T>(slice1: &[T], slice2: &[T])
where
    T: PartialEq,
{
    for item1 in slice1 {
        for item2 in slice2 {
            if item1 == item2 {
                return true;
            }
        }
    }
    false
}   

//Generate a boolean indicating whether a string is a valid email address.
pub fn have_valid_email(s: &str) -> bool {
    let email_regex = regex::Regex::new(r"^[\w\.-]+@[\w\.-]+\.\w+$").unwrap();
    email_regex.is_match(s)             
}
//Generate a boolean indicating whether a number is within a specified range.
pub fn have_number_in_range<T>(num: T, min: T, max: T) -> bool
where       
    T: PartialOrd,
{
    num >= min && num <= max
}
//Generate a boolean indicating whether a string is a palindrome.
pub fn have_palindrome(s: &str) -> bool {
    let s_clean: String = s.chars().filter(|c| c.is_alphanumeric()).collect();
    let s_rev: String = s_clean.chars().rev().collect();            

    s_clean.eq_ignore_ascii_case(&s_rev)
}       
//Generate a boolean indicating whether a vector is sorted.
pub fn have_sorted_vec<T>(vec: &Vec<T>) -> bool
where           
    T: PartialOrd,
{
    for i in 0..vec.len() - 1 {
        if vec[i] > vec[i + 1] {
            return false;
        }
    }
    true
}   

//Generate a boolean indicating whether a string is numeric.
pub fn have_numeric_str(s: &str) -> bool {          
    s.chars().all(|c| c.is_numeric())
}
//Generate a boolean indicating whether two strings are anagrams.
pub fn have_anagrams(s1: &str, s2: &str) -> bool {
    let mut chars1: Vec<char> = s1.chars().collect();
    let mut chars2: Vec<char> = s2.chars().collect();   
    chars1.sort_unstable();
    chars2.sort_unstable();
    chars1 == chars2
}

//Generate a boolean indicating whether a string contains only alphabetic characters.
pub fn have_alpha_str(s: &str) -> bool {
    s.chars().all(|c| c.is_alphabetic())
}

//Generate a boolean indicating whether a string contains only whitespace characters.
pub fn have_whitespace_str(s: &str) -> bool {
    s.chars().all(|c| c.is_whitespace())
}

//Generate a boolean indicating whether a number is even.
pub fn have_even_number<T>(num: T) -> bool
where
    T: std::ops::Rem<Output = T> + From<u8> +
    PartialEq,
{
    num % T::from(2u8) == T::from(0u8
)
}

//Generate a boolean indicating whether a number is odd.
pub fn have_odd_number<T>(num: T) -> bool
where
    T: std::ops::Rem<Output = T> + From<u8> +
    PartialEq,
{
    num % T::from(2u8) != T::from(0u8
)
}

//Generate a boolean indicating whether a string is uppercase.
pub fn have_uppercase_str(s: &str) -> bool {
    s.chars().all(|c| !c.is_lowercase())
}
//Generate a boolean indicating whether a string is lowercase.
pub fn have_lowercase_str(s: &str) -> bool {
    s.chars().all(|c| !c.is_uppercase())
}
//Generate a boolean indicating whether a vector has unique elements.
pub fn have_unique_elements<T>(vec: &Vec<T>) -> bool
where
    T: Eq + std::hash::Hash,
{
    let mut seen = HashSet::new();
    for item in vec {
        if !seen.insert(item) {
            return false;
        }
    }
    true
}

//Generate a boolean indicating whether a string is a valid URL.
pub fn have_valid_url(s: &str) -> bool {
    let url_regex = regex::Regex::new(r"^(http|https)://[
\w.-]+(\.[\w.-]+)+[/\w\.-]*$").unwrap();
    url_regex.is_match(s)
}   

//Generate a boolean indicating whether a number is prime.
pub fn have_prime_number(num: u64) -> bool {
    if num <= 1 {
        return false;
    }
    for i in 2..=((num as f64).sqrt() as u64) {
        if num % i == 0 {
            return false;
        }       

    }
    true
}       


//Generate a boolean indicating whether a string is a valid JSON.
pub fn have_valid_json(s: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(s).is_ok()            
}

//Generate a boolean indicating whether a vector contains duplicates.
pub fn have_duplicates<T>(vec: &Vec<T>) -> bool
where
    T: Eq + std::hash::Hash,
{
    let mut seen = HashSet::new();
    for item in vec {
        if !seen.insert(item) {           
            return true;
        }
    }
    false
}       

//Generate a boolean indicating whether a string is a valid IPv4 address.
pub fn have_valid_ipv4(s: &str) -> bool {
    let ipv4_regex = regex::Regex::new(r"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][     
-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$").unwrap();
    ipv4_regex.is_match(s)
}
//Generate a boolean indicating whether a string is a valid IPv6 address.
pub fn have_valid_ipv6(s: &str) -> bool {
    let ipv6_regex = regex::Regex::new(r"^(([0-9a
    
-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4}|:)|(([0-9a-fA-F]{1,4}:){1,7}:)|(([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4})|(([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2})|(([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3})|(([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4})|(([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5})|([0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6}))|(:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|(2[0-4][0-9]|[01]?[0-9][0-9]?))|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|(2[0-4][0-9]|[01]?[0-9][0-9]?))))$").unwrap();
    ipv6_regex.is_match(s)
}

//Generate a boolean indicating whether a string is a valid phone number.
pub fn have_valid_phone_number(s: &str) -> bool {
    let phone_regex = regex::Regex::new(r"^\+?[1-9]\d{1,14}$").unwrap();
    phone_regex.is_match(s)
}
//Generate a boolean indicating whether a string is a valid postal code (US).
pub fn have_valid_postal_code(s: &str) -> bool {
    let postal_regex = regex::Regex::new(r"^\d{5}(-\d{4})?$").unwrap();
    postal_regex.is_match(s)
}   

//Generate a boolean indicating whether a string is a valid credit card number.
pub fn have_valid_credit_card(s: &str) -> bool {
    let cc_regex = regex::Regex::new(r"^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})$").unwrap()
    cc_regex.is_match(s)
}

//Generate a boolean indicating whether a string is a valid date (YYYY-MM-DD).
pub fn have_valid_date(s: &str) -> bool {
    let date_regex = regex::Regex::new(r"^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$").unwrap();
    date_regex.is_match(s)
}   

//Generate a boolean indicating whether a string is a valid time (HH:MM:SS).
pub fn have_valid_time(s: &str) -> bool {
    let time_regex = regex::Regex::new(r"^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$").unwrap();
    time_regex.is_match(s)
}

//Generate a boolean indicating whether a string is a valid hexadecimal color code.
pub fn have_valid_hex_color(s: &str) -> bool {
    let hex_color_regex = regex::Regex::new(r"^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$").unwrap();
    hex_color_regex.is_match(s)
}


//Generate a boolean indicating whether a string is a valid UUID.
pub fn have_valid_uuid(s: &str) -> bool {
    let uuid_regex = regex::Regex::new(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$").unwrap();
    uuid_regex.is_match(s)
}

//Generate a boolean indicating whether a string is a valid password (at least 8 characters, including uppercase, lowercase, digit, and special character).
pub fn have_valid_password(s: &str) -> bool {
    let password_regex = regex::Regex::new(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$").unwrap();
    password_regex.is_match(s)
}   


//Generate a boolean indicating whether a string is a valid slug (lowercase letters, numbers, hyphens).
pub fn have_valid_slug(s: &str) -> bool {
    let slug_regex = regex::Regex::new(r"^[a-z0-9]+(-[a-z0-9]+)*$").unwrap();
    slug_regex.is_match(s)
}

