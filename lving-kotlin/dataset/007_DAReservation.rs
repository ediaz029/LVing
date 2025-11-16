fn main() {
    let mut v = vec![1, 2, 3];
    
    unsafe {
        let ptr = v.as_ptr();
        v.reserve(1000);
        let val = *ptr;
        println!("{}", val);
    }
}