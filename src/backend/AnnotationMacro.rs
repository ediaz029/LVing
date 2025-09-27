extern "C" {
    #[link_name = "llvm.ptr.annotation.p0"]
    fn llvm_ptr_annotation_p0(
        val: *const u8,
        annotation: *const u8,
        file: *const u8,
        line: i32,
    ) -> *const u8;
}

#[macro_export]
macro_rules! annotate {
    // Regular declarations
    ($var:ident = $value:expr, $annotation:literal, $line:expr) => {
        let $var = $value;
        annotate!(@call_llvm_annotate $var, $annotation, $line);
    };

    // Regular dec. with type:
    ($var:ident : $_:ty = $value:expr, $annotation:literal, $line:expr) => {
        let $var = $value;
        annotate!(@call_llvm_annotate $var, $annotation, $line);
    };

    // Mutables
    (mut $var:ident = $value:expr, $annotation:literal, $line:expr) => {
        let mut $var = $value;
        annotate!(@call_llvm_annotate $var, $annotation, $line);
    };

    // Mutables dec. with type:
    (mut $var:ident : $_:ty = $value:expr, $annotation:literal, $line:expr) => {
        let mut $var = $value;
        annotate!(@call_llvm_annotate $var, $annotation, $line);
    };

    // Shared annotation logic:
    (@call_llvm_annotate $var:ident, $annotation:literal, $line:expr) => {
        unsafe {
            ::llvm_ptr_annotation_p0(
                &$var as *const _ as *const u8,
                concat!($annotation, "\0").as_ptr(),
                file!().as_ptr(),
                ($line-2) as i32,
            );
        }
    }
}
