import { useEffect } from "react";

export default function Auth() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.location.href = `zit://callback?code=${code}`;
    }
  }, []);

  return (
    <div style={{textAlign:"center", padding:"100px", background:"#080c14", color:"#00e5c8", fontFamily:"sans-serif"}}>
      <h1>✓ Done!</h1>
      <p style={{color:"#a855f7"}}>Повертаємось у Zit...</p>
    </div>
  );
}