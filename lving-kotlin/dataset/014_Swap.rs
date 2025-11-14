fn main() {
	let mut s1 = String::from("Snoopy");
	let mut s2 = String::from("Scooby Doo");

	unsafe {
		let ptr1 = &mut s1 as *mut String;
		let ptr2 = &mut s2 as *mut String;

		std::ptr::swap(ptr1, ptr2);
		std::ptr::drop_in_place(ptr1);
	}
}
