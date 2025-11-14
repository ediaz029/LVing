use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;

struct SendablePtr {
    ptr: *mut String,
    freed: &'static AtomicBool,
}

unsafe impl Send for SendablePtr {}
unsafe impl Sync for SendablePtr {}

fn main() {
    let boxed = Box::new(String::from("Hi there! How are you?"));
    let freed_flag: &'static AtomicBool = Box::leak(Box::new(AtomicBool::new(false)));

    let ptr = SendablePtr {
        ptr: Box::into_raw(boxed),
        freed: freed_flag,
    };

    unsafe {
        let p1 = SendablePtr { ptr: ptr.ptr, freed: ptr.freed };
        let p2 = SendablePtr { ptr: ptr.ptr, freed: ptr.freed };

        let t1 = thread::spawn(move || {
            unsafe {
                if !p1.freed.swap(true, Ordering::AcqRel) {
                    drop(Box::from_raw(p1.ptr));
                }
            }
        });

        let t2 = thread::spawn(move || {
            unsafe {
                if !p2.freed.swap(true, Ordering::AcqRel) {
                    drop(Box::from_raw(p2.ptr));
                }
            }
        });

        t1.join().unwrap();
        t2.join().unwrap();
    }
}
