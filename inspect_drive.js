const { SignJWT, importPKCS8 } = require('jose');

const SERVICE_ACCOUNT = {
  client_email: "robot-deposito@deposito-fibra-fitness.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDOk2gftMrsYtBO\n6B2pVIG/kF8Q0WlTMylPkrQ6gFBdgJzK87CIy6O4vuMUsAyd1GsmRDg9YNY3INc8\n+3eUvikPTFGeNthYyIw2DGzEMPHSf6lNPvXd3/FeHv6sUZRoWtocNlC3LtwdgwLP\nWvdYq4LgPryuFehAwxRr6IWF3ysvFQASgLc5vxBY1tDNsxD+7WhHZX++lEYOWmRP\nYYpK8ynSxhSkZphokAXiyVVosPXv5JKzzvDzKlLKGWlxMjKv5LMR3i925eqWPVIv\nM8AO0cne91QU3OjBse4x3wwCLfrJjZX2mw7vOoF3kPh1Ra5f0FrkbXIU5tUKM9E5\n+FRvTQObAgMBAAECggEAWyFlVGNuB9VZvw2gFDTPHmLCxYkUdVtDFLML5ij4Cx+z\nS8cwcFCh090GEXjOwAvXDyUWSGGBbwWCXokzCj/PnkuVT/4y+AvU6v0VOIG9FJcz\n6XtmfLCP6u0yfXNpzJWT1dFST1WRTkWfBjnDl27mSCX1F7lbYcKNrkMAMHwwsU4/\nN+jwWTdlv7of6xHt6XAqk6yOQfH4XoPy8iRcr7g1qV7qiAF3UYnpxfxYgVEkwltV\nUFEUi77shM5DzoZZst1zv+nUyUZqiMfs3L+yrlmVsdObZSP87dy0wqYZl9JWkPc3\n8LmDycfEKnq5XvhsHNCuXn7p1PSFNQqTHoQMvNYf5QKBgQD6rYRBRuPNHN1ID6sU\nhU1lDyjP80bpYJl+OtbqglR/GihRdm4DyNNawHS1M8Z+ybIimbblpsjiCDKlH8bX\nCg191VkYAgUFJ09q1gSIQ3Q4Bu212w2wQLJ8Bj9Yo8Nm7VkPVnqLND59xL3Mv4na\n/KIO0TxzVySX+IetEx1kRzh1ZQKBgQDS9i/j89dzdtdfLVN8Nn0crHUAqu6h9RH0\nRNl52GrWZVMflSCRzJ+VMFirAybTnQrx4M9ae3O1qFOqDX6I/GXFQyEPMbtyhVl7\nQ1gRvcV13lkl8C4UWzWoQE827UXStkB2dR277rMEfSURfn3bJFdt+2xRbByZL/mO\nPhINJuiE/wKBgGZLmMTqoNt7A/H8MtxU6Zhr70OtCysBeKHCcSGRvdmAWyOjKJHy\nyg0mrHmlf0MOG9tyzug4f5F9tu0bYpEuUQMgpRLfAB1yRT5bx82zeSHD8g1cLuHW\nBQAHrKIHch32jXls2OUllLrOJoX/Q8pRffB+AiUvUoeRrAw82KmrRqbhAoGBAI05\nARY4RiKli8fLL/gXAeoQCMNJqjYBOOOss2k910duzRZ3XjY8JRhaJQFWOseueYUy\nWZzYx7zz0g4kunA5hmdnaNojELi5TA2YJ3y47VbaYhNjlXVLGcBoTJ8Yd4V3O/AQ\ntrb4NB7tJ8NuShJJYb3eccSP+xURaJ4wLyVexolBAoGAQEADcuAWd+nIhxKGMaj0\nQjsffwGKyERF8tDnIqxbNxtuk913no8jMjWMrSamZL3GXlNHAx6eT9yj2A7PQaRu\noo8T2/w1/KhqTZ8dRo4jzDQcLqPkYb9Hld2ZlBh5vxuSUmKK+C7t1/Jihj8gB41M\nQO6NxZUtyaLICbydpeQpW0I=\n-----END PRIVATE KEY-----\n"
};

async function getGoogleToken() {
  const alg = 'RS256';
  const privateKey = await importPKCS8(SERVICE_ACCOUNT.private_key, alg);
  const jwt = await new SignJWT({
    iss: SERVICE_ACCOUNT.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token"
  })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  const data = await res.json();
  return data.access_token;
}

async function listFolders() {
  const token = await getGoogleToken();
  // Folder ID for Colecta (I need to find it first, or just list root children)
  const rootId = '14Lga1RTr9xz8xEjwaFlxdLl_06oKUlVL';
  
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q='${rootId}'+in+parents+and+mimeType='application/vnd.google-apps.folder'&fields=files(id,name)`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const cats = await res.json();
  console.log("Categories:", cats.files.map(f => f.name));

  const colecta = cats.files.find(f => f.name.toLowerCase() === 'colecta');
  if (colecta) {
    const res2 = await fetch(`https://www.googleapis.com/drive/v3/files?q='${colecta.id}'+in+parents+and+mimeType='application/vnd.google-apps.folder'&fields=files(id,name)`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const folders = await res2.json();
    console.log("Colecta Folders:", folders.files.map(f => f.name));
  }
}

listFolders();
