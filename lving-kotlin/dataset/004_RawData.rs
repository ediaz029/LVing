use std::cell::UnsafeCell;
use std::thread;

struct SendablePtr(*mut String);
unsafe impl Send for SendablePtr {}
unsafe impl Sync for SendablePtr {}

fn main() {
    let mut data = UnsafeCell::new(String::from("Snoopy"));
    let raw = data.get_mut();

    unsafe {
        let ptr1 = SendablePtr(raw);
        let ptr2 = SendablePtr(raw);

        // this is a modified version of 002,
        // but i use strings and unroll the loop
        // to be more explicit.
        let t1 = thread::spawn(move || {
            for _ in 0..10_000 {
                (*ptr1.0).push('A');
            }
        });

        let t2 = thread::spawn(move || {
            for _ in 0..10_000 {
                (*ptr2.0).push('B');
            }
        });

        t1.join().unwrap();
        t2.join().unwrap();

        println!("len = {}", (*data.get()).len());
    }
}
