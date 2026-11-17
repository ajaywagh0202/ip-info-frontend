import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Clipboard, Download, ExternalLink, RefreshCw, ServerCrash } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

const scannerAppBaseUrl = String(import.meta.env.VITE_SCANNER_APP_URL || 'http://10.31.3.114:5001').replace(/\/$/, '');

const agentHealthUrl = 'http://10.31.3.114:7979/health';

function DeployCommand({ command, commandId, copiedCommand, onCopy }) {
  const isCopied = copiedCommand === commandId;

  return (
    <div className="ip-deploy-command">
      <code>{command}</code>
      <button type="button" onClick={() => onCopy(command, commandId)} aria-label={`Copy ${commandId} deployment command`}>
        {isCopied ? <Check size={16} /> : <Clipboard size={16} />}
        {isCopied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export default function IpServiceSubPlatform() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dsr_no: dsrNo = '', target_ip: targetIp = '', flag: rawFlag = 1, registration = {} } = location.state || {};
  const flag = Number(rawFlag) === 0 ? 0 : 1;
  const isOnline = flag === 1;
  const [agentState, setAgentState] = useState('checking');
  const [agentError, setAgentError] = useState('');
  const [deployExpanded, setDeployExpanded] = useState(false);
  const [deployTab, setDeployTab] = useState('windows');
  const [copiedCommand, setCopiedCommand] = useState(null);
  const scannerPayload = {
    dsr_no: registration?.dsr_no || dsrNo,
    serial_no: registration?.serial_no || '',
    pf_no: registration?.pf_no || '',
    target_ip: targetIp,
  };

  console.log('Scanner app payload:', scannerPayload);

  const scannerAppUrl = `${scannerAppBaseUrl}/?data=${encodeURIComponent(JSON.stringify(scannerPayload))}`;
  const deploymentServerUrl = scannerAppBaseUrl;
  const deployCommands = {
    windowsPowerShell: `powershell -ExecutionPolicy Bypass -Command "(New-Object System.Net.WebClient).DownloadFile('${deploymentServerUrl}/static/bootstrap_client.ps1','$env:TEMP\\itc_boot.ps1'); & '$env:TEMP\\itc_boot.ps1'"`,
    windowsPython: `python -c "import urllib.request,os,sys,subprocess; p=os.path.join(os.environ['TEMP'],'itc_d.py'); open(p,'wb').write(urllib.request.urlopen('${deploymentServerUrl}/static/deploy_client.py').read()); subprocess.call([sys.executable,p,'--server','${deploymentServerUrl}'])"`,
    unixCurl: `curl -fsSL ${deploymentServerUrl}/static/bootstrap_client.sh | bash`,
    unixWget: `wget -qO- ${deploymentServerUrl}/static/bootstrap_client.sh | bash`,
  };

  const checkAgent = useCallback(async (signal) => {
    if (!targetIp) {
      setAgentState('not-found');
      setAgentError('No target IP address was supplied. Return to the main screen and try again.');
      return;
    }
    setAgentState('checking');
    setAgentError('');
    try {
      const response = await axios.get(agentHealthUrl, {
        timeout: 5000,
        signal,
      });
      if (String(response.data?.status || '').toLowerCase() !== 'ok') throw new Error('The scanner agent did not return a healthy status.');
      setAgentState('running');
    } catch (requestError) {
      if (requestError.code === 'ERR_CANCELED') return;
      setAgentState('not-found');
      const message = requestError.friendlyMessage || 'The scanner agent could not be reached at this IP address and port 7979.';
      setAgentError(message);
    }
  }, [targetIp]);

  useEffect(() => {
    const controller = new AbortController();
    checkAgent(controller.signal);
    return () => controller.abort();
  }, [checkAgent]);

  useEffect(() => {
    const intervalId = window.setInterval(() => checkAgent(), 15000);
    return () => window.clearInterval(intervalId);
  }, [checkAgent]);

  const copyDeploymentCommand = async (command, commandId) => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = command;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopiedCommand(commandId);
    window.setTimeout(() => setCopiedCommand((current) => (current === commandId ? null : current)), 1800);
  };

  if (!location.state) {
    return (
      <section className="ip-service-page"><div className="ip-card ip-empty-card"><ServerCrash size={35} /><h1>No scan details found</h1><p>Start a scan from the IP Service screen so the target details can be carried across.</p><button className="ip-button ip-button--primary" type="button" onClick={() => navigate('/')}><ArrowLeft size={18} /> Go Back to Main</button></div></section>
    );
  }

  return (
    <section className="ip-service-page ip-subplatform-page">
      <header className="ip-scan-header">
        <div><p className="ip-kicker">ITC System Scanner Portal</p><h1>Device Scan Console</h1></div>
        <div className="ip-scan-context"><span><b>DSR:</b> {dsrNo}</span><span><b>IP:</b> {targetIp}</span><span><b>Mode:</b> {isOnline ? 'Online' : 'Offline'}</span></div>
      </header>

      {!isOnline ? <div className="ip-offline-banner"><AlertTriangle size={19} /> Offline Mode — Scan data will not be saved.</div> : null}

      <section className="ip-card ip-install-card">
        <div className="ip-card-heading"><div><p className="ip-kicker">Step 1</p><h2>How to Install the ITC Scanner Agent</h2></div></div>
        <div className="ip-python-note">
          <div className="ip-python-note__icon">
            <i className="fa-brands fa-python"></i>
          </div>

          <div className="ip-python-note__content">
            <strong>Python Required</strong>
            <p>
              If Python is not installed on this PC, install it before starting the
              Scanner Agent. During setup, select <b>Add Python to PATH</b>.
            </p>
            <p style={{ color: '#0973ff', fontSize: '0.9rem' }}>
              For the Installation of Python, download the <b>Standalone Installer</b>.
            </p>
          </div>

          <a
            className="ip-python-note__button"
            href="https://www.python.org/downloads/"
            target="_blank"
            rel="noreferrer"
          >
            <i className="fa-brands fa-python"></i>
            Install Python
            <i className="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        </div>
        <ol className="ip-install-steps">
          <li>
            <span>1</span>
            <div>
              Click the below "Download & Install Agent" button to download the Scanner Agent installer.
            </div>
          </li>

          <li>
            <span>2</span>
            <div>
              Open the folder where the installer was downloaded and double-click the installer file.
            </div>
          </li>

          <li>
            <span>3</span>
            <div>
              When the Windows security popup appears, click <b>Run</b>. The Command Prompt window will open and complete the installation automatically.
            </div>
          </li>

          <li>
            <span>4</span>
            <div>
              In the <b>Integrated Scanner Application</b>, check whether the agent status shows <b>Agent Running</b>. If it is not running, click the <b>Start Agent</b> button.
            </div>
          </li>

          <li>
            <span>5</span>
            <div>
              Click the <b><i className="fa-solid fa-play"></i> Scan This PC</b> button to scan the device details.
            </div>
          </li>

          <li>
            <span>6</span>
            <div>
              Wait a few seconds for the scan to complete. The <b>View PDF</b> button will appear once the report is ready.
            </div>
          </li>
        </ol>
      </section>

      <section className="ip-card ip-external-scanner-card">
        <div className="ip-card-heading">
          <div>
            <div className="ip-card-heading ip-kicker"><div><p className="ip-kicker">Step 2</p><h2>Integrated scanner application</h2></div></div>
            <h2>ITC Scanner Agent Console</h2>
            <p>The existing scanner application is shown here with this portal’s header retained. Your DSR and target IP are passed automatically.</p>
          </div>
          <a className="ip-button ip-button--secondary" href={scannerAppUrl} target="_blank" rel="noreferrer"><ExternalLink size={17} /> Open in new window</a>
        </div>
        <iframe className="ip-scanner-frame" title="ITC Scanner Agent Console" src={scannerAppUrl} />
      </section>

      <section className={`ip-card ip-deploy-card${deployExpanded ? ' is-expanded' : ''}`}>
        <button
          className="ip-deploy-card__header"
          type="button"
          onClick={() => setDeployExpanded((expanded) => !expanded)}
          aria-expanded={deployExpanded}
          aria-controls="deploy-client-content"
        >
          <span>
            <span className="ip-kicker">Step 3</span>
            <span className="ip-deploy-card__title">&#9889; Deploy Client Agent</span>
          </span>
          <span className="ip-deploy-card__toggle">
            {deployExpanded ? 'Click to collapse' : 'Click to expand'}
            <ChevronDown size={18} aria-hidden="true" />
          </span>
        </button>

        {deployExpanded ? (
          <div id="deploy-client-content" className="ip-deploy-card__content">
            <p className="ip-deploy-card__intro">
              Run <strong>one command</strong> on the target PC. It downloads and installs the agent, configures the server address, and registers the device without manual file copying or editing.
            </p>
            <span
              className={`ip-deploy-card__polling${agentState === 'not-found' ? ' is-pending' : ''}${agentState === 'checking' ? ' is-checking' : ''}`}
              title={agentState === 'not-found' ? agentError : undefined}
            >
              <span aria-hidden="true" />
              {agentState === 'running'
                ? 'Agent detected — re-checking every 15 seconds.'
                : agentState === 'checking'
                  ? 'Checking agent status…'
                  : 'Agent status re-checks automatically every 15 seconds.'}
            </span>

            <div className="ip-deploy-tabs" role="tablist" aria-label="Client agent operating system">
              <button className={deployTab === 'windows' ? 'is-active' : ''} type="button" role="tab" aria-selected={deployTab === 'windows'} onClick={() => setDeployTab('windows')}>&#x1FA9F; Windows</button>
              <button className={deployTab === 'linux' ? 'is-active' : ''} type="button" role="tab" aria-selected={deployTab === 'linux'} onClick={() => setDeployTab('linux')}>&#x1F427; Linux</button>
              <button className={deployTab === 'macos' ? 'is-active' : ''} type="button" role="tab" aria-selected={deployTab === 'macos'} onClick={() => setDeployTab('macos')}>&#x1F34E; macOS</button>
            </div>

            {deployTab === 'windows' ? (
              <div className="ip-deploy-pane" role="tabpanel">
                <p>Open <strong>PowerShell as Administrator</strong> on the target PC and paste:</p>
                <DeployCommand command={deployCommands.windowsPowerShell} commandId="windows-powershell" copiedCommand={copiedCommand} onCopy={copyDeploymentCommand} />
                <p>Or, if Python is installed, use this one-liner:</p>
                <DeployCommand command={deployCommands.windowsPython} commandId="windows-python" copiedCommand={copiedCommand} onCopy={copyDeploymentCommand} />
              </div>
            ) : null}

            {deployTab === 'linux' ? (
              <div className="ip-deploy-pane" role="tabpanel">
                <p>Open a <strong>terminal</strong> on the target PC and paste:</p>
                <DeployCommand command={deployCommands.unixCurl} commandId="linux-curl" copiedCommand={copiedCommand} onCopy={copyDeploymentCommand} />
                <p>If <code>curl</code> is not available, use <code>wget</code>:</p>
                <DeployCommand command={deployCommands.unixWget} commandId="linux-wget" copiedCommand={copiedCommand} onCopy={copyDeploymentCommand} />
              </div>
            ) : null}

            {deployTab === 'macos' ? (
              <div className="ip-deploy-pane" role="tabpanel">
                <p>Open <strong>Terminal</strong> on the target Mac and paste:</p>
                <DeployCommand command={deployCommands.unixCurl} commandId="macos-curl" copiedCommand={copiedCommand} onCopy={copyDeploymentCommand} />
              </div>
            ) : null}

            <p className="ip-deploy-card__note">
              The command runs <code>deploy_client.py</code>, which installs dependencies, sets the server URL, starts the agent in the background, and configures it to start after a reboot.
            </p>
          </div>
        ) : null}
      </section>
    </section>
  );
}
