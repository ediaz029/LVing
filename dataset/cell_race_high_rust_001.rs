// The vulnerability exists despite no unsafe code.

// Minimal mocks for missing crates
mod abox {
    use std::sync::{Arc, Mutex};
    pub struct AtomicBox<T>(Arc<Mutex<T>>);
    impl<T: Clone> AtomicBox<T> {
        pub fn new(t: &T) -> Self {
            AtomicBox(Arc::new(Mutex::new(t.clone())))
        }
        pub fn get(&self) -> T {
            let guard = self.0.lock().unwrap();
            (*guard).clone() // Fixed clone implementation
        }
    }
}

mod crossbeam_utils {
    pub mod thread {
        pub fn scope<F, R>(f: F) -> R 
        where F: FnOnce(&Scope) -> R {
            f(&Scope)
        }
        pub struct Scope;
        impl Scope {
            pub fn spawn<F, T>(&self, f: F) -> std::thread::JoinHandle<T>
            where F: FnOnce(&Scope) -> T, F: Send + 'static, T: Send + 'static {
                std::thread::spawn(move || f(&Scope))
            }
        }
    }
}

// Original vulnerable code below (unchanged)
#[derive(Debug, Clone, Copy)]
enum RefOrInt<'a> { Ref(&'a u64), Int(u64) }
static SOME_INT: u64 = 123;

fn main() {
    let cell = std::cell::Cell::new(RefOrInt::Ref(&SOME_INT));
    let atomic_box = abox::AtomicBox::new(&cell);

    crossbeam_utils::thread::scope(|s| {
        s.spawn(move |_| {
            let smuggled_cell = atomic_box.get();

            loop {
                smuggled_cell.set(RefOrInt::Ref(&SOME_INT));
                smuggled_cell.set(RefOrInt::Int(0xdeadbeef));
            }
        });

        loop {
            if let RefOrInt::Ref(addr) = cell.get() {
                if addr as *const u64 == &SOME_INT as *const u64 {
                    continue;
                }

                println!("Pointer is now: {:p}", addr);
                println!("Dereferencing addr will now segfault: {}", *addr);
            }
        }
    });
}