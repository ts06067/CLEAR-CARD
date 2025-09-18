import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { register } from "./authSlice";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPw] = useState("");
  const [name, setName] = useState("");
  const { loading, error } = useAppSelector(s => s.auth);
  const dispatch = useAppDispatch();
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      console.log("RegisterPage submit", { email, password, name });
    const r = await dispatch(register({ email, password, name }));
    if ((r as any).meta.requestStatus === "fulfilled") nav("/dashboard");
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-50 to-slate-200">
      <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="card w-full max-w-md">
        <div className="card-h text-2xl">Create account</div>
        <div className="card-b space-y-4">
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <form className="space-y-3" onSubmit={submit}>
            <div>
              <label className="text-sm">Name</label>
              <input className="input w-full mt-1" value={name} onChange={e=>setName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Email</label>
              <input className="input w-full mt-1" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
            </div>
            <div>
              <label className="text-sm">Password</label>
              <input className="input w-full mt-1" type="password" value={password} onChange={e=>setPw(e.target.value)} required/>
            </div>
            <button className="btn btn-primary w-full" disabled={loading}>{loading?"Creating…":"Create account"}</button>
          </form>
          <div className="text-sm text-slate-600">
            Already have an account? <Link className="underline" to="/login">Sign in</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
