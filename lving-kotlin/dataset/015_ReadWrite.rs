fn main() {
    let data = vec![1, 2, 3, 4, 5];
    unsafe {
        let ptr = &data as *const Vec<i32>;
        let r = std::ptr::read(ptr);
        println!("{:?}", r);
    }
}
