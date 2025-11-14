fn main() {
    fn get_ref<'a>() -> &'a Box<i32> {
        let x = Box::new(42);
        unsafe {
            let ptr: *const Box<i32> = &x;
            &*ptr
        }
    }
    
    let r = get_ref();
    println!("{}", r);
}
