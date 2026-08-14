// Telegram returns here after login. The signed payload arrives in the URL
// fragment (#tgAuthResult=<base64url json>) or as query params. The fragment
// never reaches the server, so an inline script decodes it and forwards to
// /auth/telegram (which verifies the HMAC and mints the session). Running it
// inline — instead of a client component — fires on parse, so there's no
// "please wait" flash while a JS bundle hydrates.
//
// `?mode=link` sends the same payload to /auth/telegram/link instead, which
// attaches the Telegram account to the session you already have rather than
// signing you into a new one. The flag is carried on our own return URL and
// stripped before forwarding: every remaining parameter is part of Telegram's
// signature, and one extra key would fail the HMAC.
const forward = `!function(){try{
  var sp=new URLSearchParams(location.search);
  var link=sp.get('mode')==='link';
  var target=link?'/auth/telegram/link':'/auth/telegram';
  var fail=function(){location.replace(link?'/profile?telegram=telegram':'/login?error=telegram')};
  var go=function(q){location.replace(target+'?'+q)};
  var raw=new URLSearchParams(location.hash.slice(1)).get('tgAuthResult');
  if(raw){
    var b=raw.replace(/-/g,'+').replace(/_/g,'/');
    while(b.length%4)b+='=';
    var by=Uint8Array.from(atob(b),function(c){return c.charCodeAt(0)});
    var o=JSON.parse(new TextDecoder().decode(by));
    var out=new URLSearchParams();
    Object.keys(o).forEach(function(k){if(o[k]!=null)out.set(k,String(o[k]))});
    return go(out.toString());
  }
  sp.delete('mode');
  var s=sp.toString();
  if(s)return go(s);
  fail();
}catch(e){location.replace('/login?error=telegram')}}();`;

export default function TelegramReturnPage() {
  return <script dangerouslySetInnerHTML={{ __html: forward }} />;
}
