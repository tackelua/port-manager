const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('yaml');
const { execFileSync } = require('child_process');
const {
  TUNNEL_CONFIG_PATH,
  SYSTEM_TUNNEL_CONFIG_PATH,
  SENSITIVE_BLACKLIST_PORTS
} = require('./constants');
const registry = require('./registry');

// RFC 1123 compliant domain regex
const DOMAIN_REGEX = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})+$/;

class TunnelManager {
  /**
   * Exposes an app to a Cloudflare subdomain.
   */
  expose(appName, domain, options = {}) {
    // 1. Validate domain format (Security check)
    if (!domain || !DOMAIN_REGEX.test(domain)) {
      throw new Error(`Domain name '${domain}' không hợp lệ theo chuẩn RFC 1123.`);
    }

    // 2. Get or allocate port
    const entry = registry.findByName(appName);
    if (!entry) {
      throw new Error(`Ứng dụng '${appName}' chưa được đăng ký trong Port Registry. Vui lòng cấp port trước!`);
    }

    const port = entry.port;

    // 3. Security Guardrail: Blacklist check
    if (SENSITIVE_BLACKLIST_PORTS.has(port) && !options.force) {
      throw new Error(
        `[SECURITY GUARDRAIL] Port ${port} nằm trong danh sách cổng nhạy cảm / database / debug cấm expose trực tiếp ra ngoài Internet! Dùng --force nếu bạn biết chính xác mình đang làm gì.`
      );
    }

    if (!fs.existsSync(TUNNEL_CONFIG_PATH)) {
      throw new Error(`Không tìm thấy file cấu hình Cloudflare Tunnel tại: ${TUNNEL_CONFIG_PATH}`);
    }

    // 4. Parse YAML
    const rawYaml = fs.readFileSync(TUNNEL_CONFIG_PATH, 'utf8');
    const config = yaml.parse(rawYaml);
    if (!config.ingress || !Array.isArray(config.ingress)) {
      config.ingress = [];
    }

    const tunnelId = config.tunnel || 'default';

    // Filter out existing rule for this hostname
    config.ingress = config.ingress.filter(rule => rule.hostname !== domain);

    // Find the catch-all rule (- service: http_status:404)
    const catchAllIndex = config.ingress.findIndex(rule => !rule.hostname && rule.service);
    const newRule = {
      hostname: domain,
      service: `http://localhost:${port}`
    };

    if (catchAllIndex !== -1) {
      config.ingress.splice(catchAllIndex, 0, newRule);
    } else {
      config.ingress.push(newRule);
      config.ingress.push({ service: 'http_status:404' });
    }

    const updatedYaml = yaml.stringify(config);

    // 5. Secure temporary file creation (CWE-377 mitigation)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'portctl-tunnel-'));
    const tmpFile = path.join(tmpDir, 'validate.yml');
    fs.writeFileSync(tmpFile, updatedYaml, { encoding: 'utf8', mode: 0o600 });

    try {
      // 6. Validate ingress using cloudflared CLI with safe execFileSync
      execFileSync('cloudflared', ['tunnel', '--config', tmpFile, 'ingress', 'validate'], { stdio: 'pipe' });

      // 7. Write to local repo config & copy to /etc/cloudflared/config.yml
      fs.writeFileSync(TUNNEL_CONFIG_PATH, updatedYaml, 'utf8');
      execFileSync('sudo', ['cp', TUNNEL_CONFIG_PATH, SYSTEM_TUNNEL_CONFIG_PATH], { stdio: 'pipe' });

      // Clean up tmpDir
      fs.rmSync(tmpDir, { recursive: true, force: true });

      // 8. Create DNS CNAME on Cloudflare edge using dynamic tunnelId
      try {
        execFileSync('cloudflared', ['tunnel', 'route', 'dns', tunnelId, domain], { stdio: 'pipe' });
      } catch (dnsErr) {
        // Ignored if already exists
      }

      // 9. Safe reload launchd daemon
      execFileSync('sudo', ['launchctl', 'kickstart', '-k', 'system/com.cloudflare.cloudflared'], { stdio: 'pipe' });

      // 10. Update registry metadata
      const canonicalData = registry.loadCanonicalApps();
      if (canonicalData.apps && canonicalData.apps[appName]) {
        canonicalData.apps[appName].tunnel = domain;
        registry.saveCanonicalApps(canonicalData);
      }

      return {
        success: true,
        domain,
        port,
        url: `https://${domain}`
      };
    } catch (err) {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
      throw new Error(`Cấu hình Cloudflare Ingress thất bại: ${err.message}`);
    }
  }

  getTunnelUrl(port) {
    try {
      if (!fs.existsSync(TUNNEL_CONFIG_PATH)) return null;
      const content = fs.readFileSync(TUNNEL_CONFIG_PATH, 'utf8');
      const regex = new RegExp(`hostname:\\s+([^\\s]+)\\s+service:\\s+http://localhost:${port}`, 'i');
      const match = content.match(regex);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}

module.exports = new TunnelManager();
