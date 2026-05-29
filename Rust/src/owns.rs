use crate::have::*;
use crate::entity::{device::Device, wallet::Wallet, car::Car, house::House};
use std::collections::HashMap;
pub struct Relation<'a> {
    pub data: HashMap<&'a str, &'a dyn std::fmt::Debug>,
}

pub fn have_relation<'a>(b: &Relation<'a>) -> bool {
    match b {
        Relation::Device(d) => have(&Some(d)),
        Relation::Wallet(w) => have(&Some(w)),
        Relation::Car(c) => have(&Some(c)),
        Relation::House(h) => have(&Some(h)),
    }
}