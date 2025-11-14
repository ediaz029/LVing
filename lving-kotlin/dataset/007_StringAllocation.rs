fn main() {
    let mut s = String::from("Hello");
    
    unsafe {
        let ptr = s.as_ptr();
        
        for _ in 0..100 {
            s.push_str(" World!");
        }
        
        let byte = *ptr;
        println!("{}", byte);
    }
}
