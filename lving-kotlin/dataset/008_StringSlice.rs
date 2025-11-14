use std::slice;

fn make_slice() -> &'static [u8] {
    let s = String::from("hello");
    let ptr = s.as_ptr();
    let len = s.len();
    unsafe { slice::from_raw_parts(ptr, len) }
}

fn main() {
    let x = make_slice();
    dbg!(x);
}
