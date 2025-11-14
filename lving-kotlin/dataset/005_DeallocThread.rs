use std::alloc::{alloc, dealloc, Layout};
use std::thread;

struct SendablePtr(*mut u8);
unsafe impl Send for SendablePtr {}

fn main() {
    unsafe {
        let layout = Layout::array::<i32>(10).unwrap();
        let ptr = alloc(layout);
        
        let slice = std::slice::from_raw_parts_mut(ptr as *mut i32, 10);
        for i in 0..10 {
            slice[i] = i as i32;
        }
        
        let ptr1 = SendablePtr(ptr);
        let ptr2 = SendablePtr(ptr);
        
        let h1 = thread::spawn(move || {
            dealloc(ptr1.0, layout);
        });
        
        let h2 = thread::spawn(move || {
            dealloc(ptr2.0, layout);
        });
        
        h1.join().unwrap();
        let _ = h2.join();
    }
}
