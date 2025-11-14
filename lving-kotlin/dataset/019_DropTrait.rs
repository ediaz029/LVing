#[derive(Debug)]
struct Resource {
    data: Box<Vec<i32>>,
}

impl Drop for Resource {
    fn drop(&mut self) {
        unsafe {
            let ptr = &*self.data as *const Vec<i32>;
            std::ptr::drop_in_place(&mut self.data);
            dbg!(ptr);
        }
    }
}

fn main() {
    let resource = Resource {
        data: Box::new(vec![1, 2, 3, 4, 5]),
    };
    dbg!(resource);
}
