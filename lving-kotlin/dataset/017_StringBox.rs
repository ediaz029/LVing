fn main() {
    struct Holder {
        data: Box<String>,
    }
    
    fn get_field<'a>() -> &'a String {
        let h = Holder {
            data: Box::new(String::from("the secret box")),
        };
        unsafe {
            let ptr: *const String = &*h.data;
            &*ptr
        }
    }
    
    let r = get_field();
    println!("{}", r);
}