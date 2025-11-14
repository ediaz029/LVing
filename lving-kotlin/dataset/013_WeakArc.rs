use std::sync::{Arc, Weak};
use std::thread;

struct Sendable(*const Vec<i32>);
unsafe impl Send for Sendable {}

fn main() {
    let arc = Arc::new(vec![1, 2, 3, 4, 5]);
    let weak: Weak<Vec<i32>> = Arc::downgrade(&arc);
    let raw = Arc::into_raw(arc);
    let ptr = Sendable(raw);
    
    let handle = thread::spawn(move || {
        unsafe {
            let arc_thread = Arc::from_raw(ptr.0);
            println!("{:?}", arc_thread);
        }
    });
    
    handle.join().unwrap();
    
    unsafe {
        let arc_main = Arc::from_raw(raw);
        println!("{:?}", arc_main);
    }
    println!("{:?}", weak.upgrade());
}
