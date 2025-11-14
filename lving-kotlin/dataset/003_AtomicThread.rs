use std::sync::atomic::{AtomicPtr, Ordering};
use std::sync::Arc;
use std::thread;

fn main() {
    let vec = vec![1, 2, 3, 4, 5];
    let data = Box::new(vec);
    let atomic_ptr = Arc::new(AtomicPtr::new(Box::into_raw(data)));
    
    let ptr1 = Arc::clone(&atomic_ptr);
    let ptr2 = Arc::clone(&atomic_ptr);
    
    let t1 = thread::spawn(move || {
        unsafe {
            let ptr = ptr1.load(Ordering::Relaxed);
            (*ptr).push(10);
            (*ptr).push(20);
        }
    });
    
    let t2 = thread::spawn(move || {
        unsafe {
            let ptr = ptr2.load(Ordering::Relaxed);
            (*ptr).push(30);
            (*ptr).push(40);
        }
    });
    
    t1.join().unwrap();
    t2.join().unwrap();
    
    unsafe {
        let ptr = atomic_ptr.load(Ordering::Relaxed);
        println!("{:?}", *ptr);
        let _ = Box::from_raw(ptr);
    }
}
