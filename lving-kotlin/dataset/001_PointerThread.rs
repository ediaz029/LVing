use std::thread;

struct SendablePtr(*mut i32);
unsafe impl Send for SendablePtr {}

fn main() {
    let mut value = 0i32;
    let ptr = &mut value as *mut i32;

    // 002 (from repo), but
    // unrolled loops & no arc->ptr.
    unsafe {
        let ptr1 = SendablePtr(ptr);
        let ptr2 = SendablePtr(ptr);
        
        let t1 = thread::spawn(move || {
            for _ in 0..1000 {
                *ptr1.0 += 1;
            }
        });
        
        let t2 = thread::spawn(move || {
            for _ in 0..1000 {
                *ptr2.0 += 1;
            }
        });
        
        t1.join().unwrap();
        t2.join().unwrap();
        
        println!("Value: {}", *ptr);
    }
}
