import { importPKCS8, SignJWT } from "jose";

const json = (res,status,body) => {
  res.setHeader("cache-control","no-store");
  res.status(status).json(body);
};

export default async function handler(req,res) {
  if (!["GET","POST"].includes(req.method)) return json(res,405,{error:"GET or POST required"});
  const teamId = process.env.APPLE_MUSIC_TEAM_ID;
  const keyId = process.env.APPLE_MUSIC_KEY_ID;
  const privateKeyValue = process.env.APPLE_MUSIC_PRIVATE_KEY;
  if (!teamId || !keyId || !privateKeyValue) return json(res,503,{configured:false,error:"Apple Music developer key is not configured"});
  try {
    const privateKey = privateKeyValue.replace(/\\n/g,"\n");
    const key = await importPKCS8(privateKey,"ES256");
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({alg:"ES256",kid:keyId})
      .setIssuer(teamId)
      .setIssuedAt(now)
      .setExpirationTime(now + 60 * 60 * 24 * 90)
      .sign(key);
    return json(res,200,{configured:true,developerToken:token});
  } catch {
    return json(res,500,{configured:false,error:"Apple Music developer key could not be read"});
  }
}
