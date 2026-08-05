"use client";

import { useEffect, useMemo, useState } from "react";

type Method = "phone" | "email";
type AccountMode = "phone" | "email" | "both";
type FlowMode = "bind" | "rebind";
type FlowStep =
  | "detail"
  | "impact"
  | "verify-current"
  | "verify-new"
  | "confirm-google"
  | "success";
type OtpError = "incorrect" | "expired" | "limited" | null;

type CompletedOperation = {
  method: Method;
  mode: FlowMode;
  oldValue: string | null;
  newValue: string;
};

const methodLabel: Record<Method, string> = {
  phone: "手机号",
  email: "邮箱",
};

const initialCredentials: Record<AccountMode, Record<Method, string | null>> = {
  phone: { phone: "+86 138 1234 5678", email: null },
  email: { phone: null, email: "maxx2@gmail.com" },
  both: { phone: "+86 138 1234 5678", email: "maxx2@gmail.com" },
};

const otpMessages: Record<Exclude<OtpError, null>, string> = {
  incorrect: "验证码不正确，请重试",
  expired: "验证码已过期，请重新获取",
  limited: "尝试次数已达上限，请稍后再试",
};

function cloneCredentials(mode: AccountMode) {
  return { ...initialCredentials[mode] };
}

function maskCredential(method: Method, value: string) {
  if (method === "phone") {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 7
      ? `${value.startsWith("+") ? "+" : ""}${digits.slice(0, 4)} **** ${digits.slice(-4)}`
      : value;
  }
  const [name, domain] = value.split("@");
  if (!domain) return value;
  return `${name.slice(0, 1)}***@${domain}`;
}

function normalizeCredential(method: Method, value: string) {
  if (method === "email") return value.trim().toLowerCase();
  const trimmed = value.trim();
  const prefix = trimmed.startsWith("+") ? "+" : "";
  return `${prefix}${trimmed.replace(/\D/g, "")}`;
}

function validateCredential(method: Method, value: string) {
  const normalized = normalizeCredential(method, value);
  if (method === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
      ? ""
      : "请输入有效的邮箱地址";
  }
  return normalized.replace(/\D/g, "").length >= 8
    ? ""
    : "请输入包含国家/地区代码的有效手机号";
}

function isGmail(value: string | null) {
  return Boolean(value && value.toLowerCase().endsWith("@gmail.com"));
}

function checkOtp(code: string): OtpError {
  if (code === "000000") return "incorrect";
  if (code === "111111") return "expired";
  if (code === "999999") return "limited";
  return code === "123456" ? null : "incorrect";
}

export default function Home() {
  const [accountMode, setAccountMode] = useState<AccountMode>("phone");
  const [credentials, setCredentials] = useState(() => cloneCredentials("phone"));
  const [selected, setSelected] = useState<Method | null>(null);
  const [flowMode, setFlowMode] = useState<FlowMode>("bind");
  const [step, setStep] = useState<FlowStep>("impact");
  const [currentVerifyMethod, setCurrentVerifyMethod] = useState<Method>("phone");
  const [draftValue, setDraftValue] = useState("");
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<OtpError>(null);
  const [credentialError, setCredentialError] = useState("");
  const [newCodeSent, setNewCodeSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [googleConfirmed, setGoogleConfirmed] = useState(false);
  const [completed, setCompleted] = useState<CompletedOperation | null>(null);

  const status = useMemo(
    () => ({ phone: Boolean(credentials.phone), email: Boolean(credentials.email) }),
    [credentials],
  );

  const availableVerifyMethods = useMemo(
    () => (["phone", "email"] as Method[]).filter((method) => credentials[method]),
    [credentials],
  );

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(
      () => setResendIn((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [resendIn]);

  function resetTransientState() {
    setDraftValue("");
    setCode("");
    setOtpError(null);
    setCredentialError("");
    setNewCodeSent(false);
    setResendIn(0);
    setGoogleConfirmed(false);
    setCompleted(null);
  }

  function switchAccountMode(mode: AccountMode) {
    setAccountMode(mode);
    setCredentials(cloneCredentials(mode));
    setSelected(null);
    resetTransientState();
  }

  function openMethod(method: Method) {
    const mode: FlowMode = credentials[method] ? "rebind" : "bind";
    const preferredMethod = credentials[method]
      ? method
      : ((["phone", "email"] as Method[]).find((item) => credentials[item]) ?? "phone");
    setSelected(method);
    setFlowMode(mode);
    setCurrentVerifyMethod(preferredMethod);
    setStep(mode === "rebind" ? "detail" : "impact");
    resetTransientState();
  }

  function closeSheet() {
    setSelected(null);
    resetTransientState();
  }

  function beginCurrentVerification() {
    setStep("verify-current");
    setCode("");
    setOtpError(null);
    setResendIn(45);
  }

  function resendCurrentCode() {
    if (resendIn > 0 || otpError === "limited") return;
    setCode("");
    setOtpError(null);
    setResendIn(45);
  }

  function verifyCurrentAccount() {
    const error = checkOtp(code);
    setOtpError(error);
    if (error) return;
    setCode("");
    setOtpError(null);
    setResendIn(0);
    setStep("verify-new");
  }

  function updateDraft(value: string) {
    setDraftValue(value);
    setCredentialError("");
    setNewCodeSent(false);
    setCode("");
    setOtpError(null);
    setResendIn(0);
  }

  function sendNewCode() {
    if (!selected || resendIn > 0) return;
    const validationMessage = validateCredential(selected, draftValue);
    if (validationMessage) {
      setCredentialError(validationMessage);
      return;
    }
    const normalized = normalizeCredential(selected, draftValue);
    if (
      normalized === "used@intent.chat" ||
      (selected === "phone" && normalized.replace(/\D/g, "").endsWith("0000"))
    ) {
      setCredentialError(`该${methodLabel[selected]}已关联其他账号，请直接使用该方式登录`);
      return;
    }
    if (
      normalized === "fail@intent.chat" ||
      (selected === "phone" && normalized.replace(/\D/g, "").endsWith("9999"))
    ) {
      setCredentialError("验证码发送失败，请稍后重试");
      return;
    }
    setNewCodeSent(true);
    setCode("");
    setOtpError(null);
    setCredentialError("");
    setResendIn(45);
  }

  function verifyNewCredential() {
    if (!selected || !newCodeSent) return;
    const error = checkOtp(code);
    setOtpError(error);
    if (error) return;

    const normalized = normalizeCredential(selected, draftValue);
    if (
      normalized === "stale@intent.chat" ||
      (selected === "phone" && normalized.replace(/\D/g, "").endsWith("7777"))
    ) {
      setCredentialError("登录方式已发生变化，请刷新后重试");
      setOtpError(null);
      return;
    }

    setOtpError(null);
    if (flowMode === "rebind" && selected === "email" && isGmail(credentials.email)) {
      setStep("confirm-google");
      return;
    }
    finishFlow(normalized);
  }

  function finishFlow(normalizedValue?: string) {
    if (!selected) return;
    const nextValue = normalizedValue ?? normalizeCredential(selected, draftValue);
    const operation: CompletedOperation = {
      method: selected,
      mode: flowMode,
      oldValue: credentials[selected],
      newValue: nextValue,
    };
    setCredentials((current) => ({ ...current, [selected]: nextValue }));
    setCompleted(operation);
    setStep("success");
  }

  const oldValue = selected ? credentials[selected] : null;
  const currentTarget = credentials[currentVerifyMethod];
  const sheetTitle = selected
    ? step === "detail"
      ? `${methodLabel[selected]}详情`
      : step === "impact"
        ? `${flowMode === "rebind" ? "更换" : "添加"}${methodLabel[selected]}`
        : step === "verify-current"
          ? "验证当前账号"
          : step === "verify-new"
            ? `验证新${methodLabel[selected]}`
            : step === "confirm-google"
              ? "确认更换邮箱"
              : `${methodLabel[selected]}已${flowMode === "rebind" ? "更换" : "添加"}`
    : "";

  return (
    <main className="demo-shell">
      <aside className="demo-notes" aria-label="Demo instructions">
        <div className="brand-mark">intent</div>
        <p className="eyebrow">PRD-ALIGNED INTERACTIVE DEMO</p>
        <h1>登录方式<br />增绑与换绑</h1>
        <p className="summary">
          从“编辑资料”管理手机号与邮箱。所有变更均先验证当前账号，再验证新方式；操作不会创建新账号。
        </p>
        <div className="scenario-card">
          <span>预览账号状态</span>
          <div className="segment" role="group" aria-label="切换账号状态">
            {([
              ["phone", "仅手机号"],
              ["email", "仅邮箱"],
              ["both", "均已绑定"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                className={accountMode === value ? "active" : ""}
                onClick={() => switchAccountMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="demo-test-card">
          <b>Demo 测试数据</b>
          <p><code>123456</code> 正确　<code>000000</code> 错误</p>
          <p><code>111111</code> 过期　<code>999999</code> 达到上限</p>
          <p><code>used@intent.chat</code> 已被占用</p>
          <p><code>fail@intent.chat</code> 发送失败</p>
          <p><code>stale@intent.chat</code> 状态已变化</p>
        </div>

        <ul className="principles">
          <li><span>01</span>手机号与邮箱固定展示，不提供解绑</li>
          <li><span>02</span>验证码用途明确隔离</li>
          <li><span>03</span>Gmail 换绑提交前二次确认</li>
        </ul>
      </aside>

      <section className="phone-stage" aria-label="Intent mobile demo">
        <div className="phone">
          <div className="status-bar">
            <span>16:24</span>
            <div className="dynamic-island"><i /><i /><i /><i /></div>
            <div className="status-icons"><span>◔</span><b>82</b></div>
          </div>

          <header className="app-header">
            <button className="icon-button" aria-label="返回">‹</button>
            <h2>编辑资料</h2>
            <span className="header-spacer" />
          </header>

          <div className="avatar-wrap" aria-label="用户头像">
            <div className="avatar-art">
              <span className="face"><i /><i /></span>
              <span className="body-shape" />
            </div>
            <button className="edit-badge" aria-label="编辑头像">✎</button>
          </div>

          <div className="scroll-area">
            <section className="profile-card" aria-labelledby="profile-heading">
              <h3 id="profile-heading">个人资料</h3>
              <ProfileRow label="名字" value="Maxx2" />
              <ProfileRow label="用户名" value="maxx22222" />
              <ProfileRow label="性别" value="女性" />
              <ProfileRow label="位置" value="中国" />
              <ProfileRow label="简介" value="今天也很开心" />
            </section>

            <h3 className="group-title">登录方式</h3>
            <section className="profile-card login-card" aria-labelledby="login-heading">
              <h3 id="login-heading" className="sr-only">登录方式</h3>
              <MethodRow
                icon="☎"
                label="手机号"
                value={credentials.phone ?? "未绑定"}
                unbound={!status.phone}
                onClick={() => openMethod("phone")}
              />
              <MethodRow
                icon="@"
                label="邮箱"
                value={credentials.email ?? "未绑定"}
                unbound={!status.email}
                onClick={() => openMethod("email")}
              />
            </section>
            <p className="private-note">仅用于登录和账号安全，不会展示给其他用户</p>
          </div>

          <div className="home-indicator" />

          {selected && (
            <div className="sheet-layer" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
              <button className="scrim" aria-label="关闭" onClick={closeSheet} />
              <section className="bottom-sheet">
                <div className="sheet-handle" />
                <div className="sheet-header">
                  <button onClick={closeSheet} aria-label="关闭">×</button>
                  <h3 id="sheet-title">{sheetTitle}</h3>
                  <span />
                </div>

                {step === "detail" && (
                  <div className="sheet-content">
                    <div className="credential-icon">{selected === "phone" ? "☎" : "@"}</div>
                    <p className="detail-label">当前{methodLabel[selected]}</p>
                    <strong className="detail-value">{oldValue}</strong>
                    {selected === "email" && isGmail(oldValue) && (
                      <div className="google-note"><b>G</b><span>该 Gmail 邮箱也可用于 Google 登录</span></div>
                    )}
                    <p className="safe-copy">此信息仅用于登录和账号安全，不会展示在个人主页。</p>
                    <button className="primary-button" onClick={() => setStep("impact")}>更换{methodLabel[selected]}</button>
                  </div>
                )}

                {step === "impact" && (
                  <div className="sheet-content">
                    <div className={flowMode === "rebind" ? "warning-icon" : "credential-icon"}>
                      {flowMode === "rebind" ? "!" : "+"}
                    </div>
                    <h4>
                      {flowMode === "rebind"
                        ? `更换后，旧${methodLabel[selected]}将立即失效`
                        : `为当前账号添加${methodLabel[selected]}`}
                    </h4>
                    <p className="impact-copy">
                      {flowMode === "rebind"
                        ? `新${methodLabel[selected]}会进入当前账号，资料、好友、群组、消息与历史数据均保持不变。`
                        : `添加后可使用手机号和邮箱进入同一账号，不会创建新账号或改变任何账号数据。`}
                    </p>
                    {flowMode === "rebind" && selected === "email" && isGmail(oldValue) && (
                      <div className="warning-box">
                        更换后，你将无法再用 {maskCredential("email", oldValue ?? "")} 的 Google 账号登录本账号。
                      </div>
                    )}
                    <button className="primary-button" onClick={beginCurrentVerification}>继续并验证当前账号</button>
                    <button className="text-button" onClick={closeSheet}>
                      {flowMode === "rebind" ? "暂不更换" : "暂不添加"}
                    </button>
                  </div>
                )}

                {step === "verify-current" && currentTarget && (
                  <div className="sheet-content">
                    <p className="purpose-badge">验证码用途：验证当前账号</p>
                    <h4>验证当前账号</h4>
                    <p className="impact-copy">为保障账号安全，请先验证你当前的登录方式。</p>
                    <div className="verify-target">
                      <span>{methodLabel[currentVerifyMethod]}</span>
                      <b>{maskCredential(currentVerifyMethod, currentTarget)}</b>
                    </div>
                    <OtpInput value={code} onChange={(value) => { setCode(value); setOtpError(null); }} error={otpError} />
                    <button
                      className="resend-button"
                      disabled={resendIn > 0 || otpError === "limited"}
                      onClick={resendCurrentCode}
                    >
                      {resendIn > 0 ? `重新发送（${resendIn}s）` : "重新获取验证码"}
                    </button>
                    {availableVerifyMethods.length > 1 && (
                      <button
                        className="switch-verify-button"
                        onClick={() => {
                          const next = availableVerifyMethods.find((method) => method !== currentVerifyMethod);
                          if (next) {
                            setCurrentVerifyMethod(next);
                            setCode("");
                            setOtpError(null);
                            setResendIn(45);
                          }
                        }}
                      >
                        换一种方式验证
                      </button>
                    )}
                    <button
                      className="primary-button"
                      disabled={code.length !== 6 || otpError === "limited"}
                      onClick={verifyCurrentAccount}
                    >
                      验证并继续
                    </button>
                  </div>
                )}

                {step === "verify-new" && (
                  <div className="sheet-content">
                    <p className="purpose-badge">验证码用途：验证新{methodLabel[selected]}</p>
                    <h4>验证新{methodLabel[selected]}</h4>
                    <p className="impact-copy">验证成功后，新{methodLabel[selected]}才会绑定到当前账号。</p>
                    <label className="field-label" htmlFor="credential">新{methodLabel[selected]}</label>
                    <input
                      id="credential"
                      className={`text-input ${credentialError ? "input-error" : ""}`}
                      value={draftValue}
                      onChange={(event) => updateDraft(event.target.value)}
                      placeholder={selected === "phone" ? "+86 138 0000 0000" : "name@example.com"}
                    />
                    {credentialError && <p className="inline-error" role="alert">{credentialError}</p>}
                    <button
                      className="send-code-button"
                      disabled={!draftValue || resendIn > 0}
                      onClick={sendNewCode}
                    >
                      {newCodeSent && resendIn > 0 ? `重新发送（${resendIn}s）` : newCodeSent ? "重新发送验证码" : "获取验证码"}
                    </button>
                    {newCodeSent && (
                      <>
                        <OtpInput value={code} onChange={(value) => { setCode(value); setOtpError(null); }} error={otpError} />
                        <button
                          className="primary-button"
                          disabled={code.length !== 6 || otpError === "limited"}
                          onClick={verifyNewCredential}
                        >
                          验证新{methodLabel[selected]}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {step === "confirm-google" && oldValue && (
                  <div className="sheet-content">
                    <div className="warning-icon">!</div>
                    <h4>确认更换邮箱</h4>
                    <div className="confirmation-summary">
                      <span>新邮箱</span>
                      <b>{normalizeCredential("email", draftValue)}</b>
                    </div>
                    <div className="warning-box strong-warning">
                      更换后，你将无法再用 {maskCredential("email", oldValue)} 的 Google 账号登录本账号。
                    </div>
                    <label className="confirm-check">
                      <input
                        type="checkbox"
                        checked={googleConfirmed}
                        onChange={(event) => setGoogleConfirmed(event.target.checked)}
                      />
                      <span>我已了解上述影响</span>
                    </label>
                    <button
                      className="primary-button"
                      disabled={!googleConfirmed}
                      onClick={() => finishFlow()}
                    >
                      确认更换
                    </button>
                    <button className="text-button" onClick={() => setStep("verify-new")}>返回修改</button>
                  </div>
                )}

                {step === "success" && completed && (
                  <div className="sheet-content success-content">
                    <div className="success-icon">✓</div>
                    <h4>{methodLabel[completed.method]}已{completed.mode === "rebind" ? "更换" : "添加"}</h4>
                    <p>新{methodLabel[completed.method]} {maskCredential(completed.method, completed.newValue)} 已可用于登录当前账号。</p>
                    <div className="result-list">
                      <p><b>账号数据</b><span>资料、好友、群组、消息和历史数据均保持不变</span></p>
                      {completed.mode === "rebind" ? (
                        <>
                          <p><b>旧登录方式</b><span>立即失效</span></p>
                          <p><b>设备会话</b><span>当前设备保持登录，其他设备需要重新登录</span></p>
                          {completed.method === "phone" && (
                            <p><b>手机号搜索</b><span>新手机号指向原账号，旧手机号不再返回原账号</span></p>
                          )}
                          {completed.method === "email" && isGmail(completed.oldValue) && (
                            <p><b>Google 登录</b><span>旧 Gmail 对应的 Google 登录立即失效</span></p>
                          )}
                        </>
                      ) : (
                        <p><b>设备会话</b><span>增绑不会使其他设备退出登录</span></p>
                      )}
                    </div>
                    <button className="primary-button" onClick={closeSheet}>完成</button>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <button className="profile-row">
      <span>{label}</span><span className="row-value">{value}</span><b>›</b>
    </button>
  );
}

function MethodRow({ icon, label, value, unbound, onClick }: { icon: string; label: string; value: string; unbound: boolean; onClick: () => void }) {
  return (
    <button className="method-row" onClick={onClick}>
      <span className="method-icon">{icon}</span>
      <span className="method-label">{label}</span>
      <span className={unbound ? "method-value unbound" : "method-value"}>{value}</span>
      <b>›</b>
    </button>
  );
}

function OtpInput({ value, onChange, error }: { value: string; onChange: (value: string) => void; error: OtpError }) {
  return (
    <div className="otp-wrap">
      <input
        aria-label="验证码"
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
      />
      <div className={`otp-boxes ${error ? "has-error" : ""}`} aria-hidden="true">
        {Array.from({ length: 6 }).map((_, index) => <span key={index}>{value[index] ?? ""}</span>)}
      </div>
      {error && <p className="inline-error centered" role="alert">{otpMessages[error]}</p>}
    </div>
  );
}
