impl<R: Read> BufRead for AccReader<R> { 
     fn fill_buf(&mut self) -> io::Result<&[u8]> { 
         let available = self.buf.len() - self.pos;  // self.buf.len() >= pos 
         if available == 0 { 
             let old_len = self.buf.len(); 
             self.buf.reserve(self.inc); 
             unsafe { self.buf.set_len(old_len + self.inc); } 
  
             let (read, error) = match self.source.read(&mut self.buf[self.pos..]) { 
                 Ok(n) => (n, None), 
                 Err(e) => (0, Some(e)), 
             }; 
             unsafe { self.buf.set_len(old_len + read); } 
  
             if let Some(e) = error { 
                 Err(e) 
             } else { 
                 Ok(&self.buf[self.pos..]) 
             } 
         } else { 
             Ok(&self.buf[self.pos..]) 
         } 
     } 
  
     fn consume(&mut self, amt: usize) { 
         self.pos = cmp::min(self.pos + amt, self.buf.len()); 
     } 
 } 