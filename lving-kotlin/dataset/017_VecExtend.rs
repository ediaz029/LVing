fn main() {
    let mut vec = vec![1, 2, 3];
    
    unsafe {
        let first_ptr = &vec[0] as *const i32;
        let extension = vec![4; 1000];
        vec.extend_from_slice(&extension);
        
        let v = *first_ptr;
        println!("{}", v);
    }
}
