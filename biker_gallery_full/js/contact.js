function showFE(id,msg){const e=document.getElementById(id);if(e){e.textContent=msg;e.classList.add('show');}}
function clearFE(id){const e=document.getElementById(id);if(e){e.textContent='';e.classList.remove('show');}}

document.addEventListener('DOMContentLoaded',function(){
  /* Name blur */
  document.getElementById('cName').addEventListener('blur',function(){
    if(!this.value.trim()){showFE('errCName','Name is required.');this.classList.add('invalid');}
    else{clearFE('errCName');this.classList.remove('invalid');this.classList.add('valid');}
  });
  /* Phone blur */
  document.getElementById('cPhone').addEventListener('blur',function(){
    if(this.value.trim().length<10){showFE('errCPhone','Enter a valid 10-digit phone number.');this.classList.add('invalid');}
    else{clearFE('errCPhone');this.classList.remove('invalid');this.classList.add('valid');}
  });
});

function sendMsg() {
  const name  = document.getElementById('cName').value.trim();
  const phone = document.getElementById('cPhone').value.trim();
  const msg   = document.getElementById('cMsg').value.trim();
  if(!name){showFE('errCName','Name is required.'); document.getElementById('cName').focus(); return;}
  if(phone.length<10){showFE('errCPhone','Enter a valid 10-digit phone number.'); document.getElementById('cPhone').focus(); return;}
  if(!msg){alert('Please enter a message.'); return;}
  document.getElementById('cName').value='';
  document.getElementById('cPhone').value='';
  document.getElementById('cMsg').value='';
  clearFE('errCName'); clearFE('errCPhone');
  document.getElementById('cName').classList.remove('va