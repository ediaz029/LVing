use std::thread;

struct Sendable(*const i32);
unsafe impl Send for Sendable {}

fn main() {
    let mut vec1 = vec![10, 20, 30, 40, 50];
    let mut vec2 = vec![100, 200];
    let ptr = Sendable(&vec1[3] as *const i32);
    let handle = thread::spawn(move || {
        unsafe {
            let mut x = *ptr.0;
            dbg!(x);
        }
    });
    std::mem::swap(&mut vec1, &mut vec2);
    drop(vec2);
    handle.join().unwrap();
}
