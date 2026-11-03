const axios = require('axios');
const { encryptCredentials, decryptCredentials } = require('./seoConnectorService');

const isoDate = date => date.toISOString().slice(0,10);

async function refreshAccessToken(connection, config) {
  const stored = decryptCredentials(connection.token_encrypted);
  if (stored.access_token && (!connection.token_expires_at || new Date(connection.token_expires_at).getTime() > Date.now()+60000)) return { accessToken:stored.access_token, encrypted:connection.token_encrypted, expiresAt:connection.token_expires_at };
  if (!stored.refresh_token) throw new Error('Google 授权已过期且没有刷新令牌，请重新授权');
  const response = await axios.post('https://oauth2.googleapis.com/token',new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,refresh_token:stored.refresh_token,grant_type:'refresh_token'}).toString(),{headers:{'Content-Type':'application/x-www-form-urlencoded'},timeout:15000});
  const accessToken=response.data?.access_token;
  if(!accessToken)throw new Error('Google 未返回刷新后的访问令牌');
  return {accessToken,encrypted:encryptCredentials({access_token:accessToken,refresh_token:stored.refresh_token,scope:response.data.scope||stored.scope}),expiresAt:new Date(Date.now()+Number(response.data.expires_in||3600)*1000)};
}

async function fetchPropertyData(accessToken, propertyUrl, pageUrl) {
  const end=new Date(); end.setUTCDate(end.getUTCDate()-1);
  const start=new Date(end); start.setUTCDate(start.getUTCDate()-27);
  const headers={Authorization:`Bearer ${accessToken}`,Accept:'application/json'};
  const analytics=await axios.post(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`,{startDate:isoDate(start),endDate:isoDate(end),dimensions:['date'],rowLimit:25000,dataState:'final'},{headers,timeout:20000});
  let inspection=null;
  try {
    const response=await axios.post('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',{inspectionUrl:pageUrl,siteUrl:propertyUrl},{headers,timeout:20000});
    inspection=response.data?.inspectionResult?.indexStatusResult||null;
  } catch (err) {
    inspection={verdict:'UNAVAILABLE',coverageState:err.response?.data?.error?.message||'URL Inspection 暂不可用'};
  }
  const metrics=(analytics.data?.rows||[]).map(row=>({date:String(row.keys?.[0]||''),clicks:Number(row.clicks||0),impressions:Number(row.impressions||0),ctr:Number(row.ctr||0),position:Number.isFinite(Number(row.position))?Number(row.position):null})).filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date));
  return {metrics,inspection,range:{startDate:isoDate(start),endDate:isoDate(end)}};
}

module.exports={encryptCredentials,refreshAccessToken,fetchPropertyData};
