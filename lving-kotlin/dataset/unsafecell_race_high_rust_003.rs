use std::sync::Arc;
use std::thread;
use std::cell::UnsafeCell;

struct SharedData {
    value: UnsafeCell<i32>,
}

unsafe impl Send for SharedData {}
unsafe impl Sync for SharedData {}

fn main() {
    let data = Arc::new(SharedData {
        value: UnsafeCell::new(42),
    });

    let handles: Vec<_> = (0..2)
        .map(|_| {
            let data = Arc::clone(&data);
            thread::spawn(move || {
                unsafe {
                    // directly modify the value inside UnsafeCell
                    let value_ptr = data.value.get();
                    *value_ptr += 1; // modify the value concurrently -> data race
                    println!("Value modified in thread: {}", *value_ptr);
                }
            })
        })
        .collect();

    for handle in handles {
        handle.join().unwrap();
    }
}