use std::thread;

trait Animal {
    fn make_sound(&self) -> &str;
}

#[derive(Debug)]
struct Dog {
    name: String,
    age: i32,
}

impl Animal for Dog {
    fn make_sound(&self) -> &str {
        "Woof!"
    }
}

struct Sendable(*const Dog);
unsafe impl Send for Sendable {}

fn main() {
    let dog = Box::new(Dog {
        name: String::from("Snoopy"),
        age: 75,
    });
    
    let dog_ptr = dog.as_ref() as *const Dog;
    let ptr = Sendable(dog_ptr);
    
    let handle = thread::spawn(move || {
        
        unsafe {
            println!("Thread: name={}, age={}", (*ptr.0).name, (*ptr.0).age);
        }
    });
    
    let animal: Box<dyn Animal> = dog;
    println!("{}", animal.make_sound());
    drop(animal);
    unsafe {
        let x = &*dog_ptr;
        dbg!(x);
    }
    handle.join().unwrap();
}
