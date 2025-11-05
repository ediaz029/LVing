// Read from the stream into the internal buffer as much as possible, 
 // but no more than the provided number of bytes. 
 // Updates the buffer length to the actual number of bytes read, even 
 // in case of errors. 
 fn read_up_to(&mut self, n: u64) -> io::Result<()> { 
     let old_len = self.buf.len(); 
     self.buf.reserve(n as usize); 
     unsafe { self.buf.set_len(old_len + n as usize); } 
  
     let mut error = None; 
     let mut read = 0; 
     { 
         let mut target = &mut self.buf[old_len..]; 
         while !target.is_empty() { 
             match self.source.read(target) { 
                 Ok(0) => break, 
                 Ok(n) => { read += n; let tmp = target; target = &mut tmp[n..]; } 
                 Err(ref e) if e.kind() == io::ErrorKind::Interrupted => {} 
                 Err(e) => { error = Some(e); break; }, 
             } 
         } 
     } 
     unsafe { self.buf.set_len(old_len + read as usize); } 
  
     if let Some(e) = error { 
         Err(e) 
     } else { 
         Ok(()) 
     } 
 } 