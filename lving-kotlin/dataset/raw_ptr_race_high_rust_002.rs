use std::thread;
use std::sync::Arc;

// create a wrapper struct for a raw pointer
struct SendablePtr(*mut i32);

unsafe impl Send for SendablePtr {}

fn main() {
    let data = Arc::new(42);
    let raw_data = Arc::into_raw(data) as *mut i32;

    let handles: Vec<_> = (0..2)
        .map(|_| {
            // create a new SendablePtr to pass to each thread
            let sendable_ptr = SendablePtr(raw_data);
            thread::spawn(move || {
                unsafe {
                    *sendable_ptr.0 += 1; // modify the value concurrently -> data race
                    println!("Value modified in thread: {}", *sendable_ptr.0);
                }
            })
        })
        .collect();

    for handle in handles {
        handle.join().unwrap();
    }
}