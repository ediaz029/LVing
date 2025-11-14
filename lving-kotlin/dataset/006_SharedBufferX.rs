use std::thread;
use std::sync::Arc;
use std::cell::UnsafeCell;

struct FatSendable {
    data: UnsafeCell<Vec<i32>>,
    size: usize,
}

unsafe impl Sync for FatSendable {}

impl FatSendable {
    fn new(size: usize) -> Self {
        Self {
            data: UnsafeCell::new(vec![0; size]),
            size,
        }
    }
    
    unsafe fn write(&self, index: usize, value: i32) {
        (*self.data.get())[index] = value;
    }
    
    unsafe fn read(&self, index: usize) -> i32 {
        (*self.data.get())[index]
    }
}

fn main() {
    let buffer = Arc::new(FatSendable::new(10));
    let mut handles = vec![];
    
    for i in 0..10 {
        let buf = Arc::clone(&buffer);
        let h = thread::spawn(move || {
            unsafe {
                buf.write(i, i as i32 * 100);
            }
        });
        handles.push(h);
    }
    
    for h in handles {
        h.join().unwrap();
    }
    
    for i in 0..10 {
        let val = unsafe { buffer.read(i) };
        println!("{}: {}", i, val);
    }
}
