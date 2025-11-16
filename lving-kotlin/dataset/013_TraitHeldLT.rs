fn main() {
    trait Processor {
        fn get_data(&self) -> &Vec<i32>;
    }
    
    struct DataHolder {
        data: Vec<i32>,
    }
    
    impl Processor for DataHolder {
        fn get_data(&self) -> &Vec<i32> {
            &self.data
        }
    }
    
    fn process<'a>() -> &'a Vec<i32> {
        let holder = DataHolder {
            data: vec![1, 2, 3, 4, 5],
        };
        let trait_obj: &dyn Processor = &holder;
        let result = trait_obj.get_data();
        unsafe {
            let ptr: *const Vec<i32> = result;
            &*ptr
        }
    }
    
    let r = process();
    println!("{:?}", r);
}
