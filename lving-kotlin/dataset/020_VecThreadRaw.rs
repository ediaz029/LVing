use std::thread;

struct VecParts {
    ptr: *mut i32,
    len: usize,
    cap: usize,
}
unsafe impl Send for VecParts {}
impl Copy for VecParts {}
impl Clone for VecParts {
    fn clone(&self) -> Self {
        VecParts {
            ptr: self.ptr,
            len: self.len,
            cap: self.cap,
        }
    }
}


fn main() {
    let mut vec = vec![1, 2, 3, 4, 5];
    
    let parts = VecParts {
        ptr: vec.as_mut_ptr(),
        len: vec.len(),
        cap: vec.capacity(),
    };
    
    std::mem::forget(vec);
    
    let handle = thread::spawn(move || {
        let mut x: i32 = 0;
        for i in 0..6000 {
            x = x.wrapping_add(i);
        }
        
        unsafe {
            let vec_thread = Vec::from_raw_parts(parts.ptr, parts.len, parts.cap);
            println!("{:?}", vec_thread);
        }
    });
    
    handle.join().unwrap();
    
    unsafe {
        let vec_main = Vec::from_raw_parts(parts.ptr, parts.len, parts.cap);
        println!("{:?}", vec_main);
    }
}
