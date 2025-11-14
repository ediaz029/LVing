use std::marker::PhantomData;

struct Wrapper<T> {
    ptr: *mut T,
    _phantom: PhantomData<T>,
}

impl<T> Wrapper<T> {
    fn new(value: T) -> Self {
        Wrapper {
            ptr: Box::into_raw(Box::new(value)),
            _phantom: PhantomData,
        }
    }
    
    fn get(&self) -> &T {
        unsafe { &*self.ptr }
    }
}

impl<T> Drop for Wrapper<T> {
    fn drop(&mut self) {
        unsafe {
            let _ = Box::from_raw(self.ptr);
        }
    }
}

fn main() {
    let wrapper = Wrapper::new(vec![1, 2, 3, 4, 5]);
    
    unsafe {
        let wrapper_clone: Wrapper<Vec<i32>> = std::ptr::read(&wrapper);
        println!("O: {:?}", wrapper.get());
        println!("C: {:?}", wrapper_clone.get());
    }
}
