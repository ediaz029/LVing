use std::thread;

struct SendablePtr(*const i32);
unsafe impl Send for SendablePtr {}
unsafe impl Sync for SendablePtr {}

fn main() {
    let boxed = Box::new(1989);
    let sendable_ptr = SendablePtr(&*boxed as *const i32);

    unsafe {
        let t1 = thread::spawn(move || {
            let value = *sendable_ptr.0;
            dbg!(value);
        });
        
        drop(boxed);
        t1.join().unwrap();
    }
}
