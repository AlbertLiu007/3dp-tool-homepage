type WeComApiResponse = {
  errcode?: number;
  errmsg?: string;
};

type WeComTokenResponse = WeComApiResponse & {
  access_token?: string;
  expires_in?: number;
};

type WeComIdentityResponse = WeComApiResponse & {
  UserId?: string;
  OpenId?: string;
};

type WeComMemberResponse = WeComApiResponse & {
  userid?: string;
  name?: string;
  department?: number[];
  status?: number;
};

export type VerifiedWeComEmployee = {
  userId: string;
  name: string;
  departments: number[];
  corpId: string;
};

export class WeComAuthError extends Error {
  constructor(
    message: string,
    readonly reason: 'configuration' | 'unauthorized' | 'upstream',
  ) {
    super(message);
    this.name = 'WeComAuthError';
  }
}

function requiredEnvironmentVariable(name: 'WECOM_CORP_ID' | 'WECOM_AGENT_ID' | 'WECOM_APP_SECRET' | 'WECOM_CALLBACK_URL') {
  const value = process.env[name]?.trim();
  if (!value) throw new WeComAuthError(`${name} is not configured.`, 'configuration');
  return value;
}

export function getWeComConfiguration() {
  return {
    corpId: requiredEnvironmentVariable('WECOM_CORP_ID'),
    agentId: requiredEnvironmentVariable('WECOM_AGENT_ID'),
    appSecret: requiredEnvironmentVariable('WECOM_APP_SECRET'),
    callbackUrl: requiredEnvironmentVariable('WECOM_CALLBACK_URL'),
  };
}

async function requestWeCom<T extends WeComApiResponse>(url: URL) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) throw new WeComAuthError(`WeCom request failed with HTTP ${response.status}.`, 'upstream');

  const payload = (await response.json()) as T;
  if (payload.errcode !== 0) {
    throw new WeComAuthError(`WeCom API error ${payload.errcode}: ${payload.errmsg ?? 'unknown error'}.`, 'upstream');
  }

  return payload;
}

async function getAccessToken(corpId: string, appSecret: string) {
  const url = new URL('https://qyapi.weixin.qq.com/cgi-bin/gettoken');
  url.searchParams.set('corpid', corpId);
  url.searchParams.set('corpsecret', appSecret);
  const payload = await requestWeCom<WeComTokenResponse>(url);

  if (!payload.access_token) throw new WeComAuthError('WeCom did not return an access token.', 'upstream');
  return payload.access_token;
}

export function buildWeComQrLoginUrl(state: string, language: 'zh' | 'en' = 'zh') {
  const configuration = getWeComConfiguration();
  const url = new URL('https://open.work.weixin.qq.com/wwopen/sso/qrConnect');
  url.searchParams.set('appid', configuration.corpId);
  url.searchParams.set('agentid', configuration.agentId);
  url.searchParams.set('redirect_uri', configuration.callbackUrl);
  url.searchParams.set('state', state);
  url.searchParams.set('lang', language);
  return url;
}

export async function verifyWeComEmployee(code: string): Promise<VerifiedWeComEmployee> {
  const configuration = getWeComConfiguration();
  const accessToken = await getAccessToken(configuration.corpId, configuration.appSecret);

  const identityUrl = new URL('https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo');
  identityUrl.searchParams.set('access_token', accessToken);
  identityUrl.searchParams.set('code', code);
  const identity = await requestWeCom<WeComIdentityResponse>(identityUrl);

  if (!identity.UserId || identity.OpenId) {
    throw new WeComAuthError('The authenticated account is not an enterprise member.', 'unauthorized');
  }

  const memberUrl = new URL('https://qyapi.weixin.qq.com/cgi-bin/user/get');
  memberUrl.searchParams.set('access_token', accessToken);
  memberUrl.searchParams.set('userid', identity.UserId);
  const member = await requestWeCom<WeComMemberResponse>(memberUrl);

  if (!member.userid || member.userid !== identity.UserId || member.status !== 1) {
    throw new WeComAuthError('The enterprise member is not active.', 'unauthorized');
  }

  return {
    userId: member.userid,
    name: member.name?.trim() || member.userid,
    departments: Array.isArray(member.department) ? member.department.filter(Number.isInteger) : [],
    corpId: configuration.corpId,
  };
}
