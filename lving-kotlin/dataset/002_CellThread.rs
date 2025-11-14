use std::cell::Cell;
use std::thread;

struct SendablePtr(*mut i32);
unsafe impl Send for SendablePtr {}

fn main() {
    let cell = Cell::new(0);
    let ptr = cell.as_ptr();
    
    unsafe {
        let ptr1 = SendablePtr(ptr);
        let ptr2 = SendablePtr(ptr);
        
        let t1 = thread::spawn(move || {
            for i in 0..1000 {
                *ptr1.0 += i;
            }
        });
        
        let t2 = thread::spawn(move || {
            for i in 0..1000 {
                *ptr2.0 += i;
            }
        });
        
        t1.join().unwrap();
        t2.join().unwrap();
        
        println!("Value: {}", cell.get());
    }
}
