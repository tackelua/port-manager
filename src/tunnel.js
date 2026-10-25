const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { execSync } = require('child_process');
const {
  TUNNEL_CONFIG_PATH,
  SYSTEM_TUNNEL_CONFIG_PATH,
  SENSITIVE_BLACKLIST_PORTS
} = require('./constants');
const registry = require('./registry');

class TunnelManager {
  /**
   * Exposes an app to a Cloudflare subdomain.
   */
  expose(appName, domain, options = {}) {
    // 1. Get or allocate port
    const entry = registry.findByName(appName);
    if (!entry) {
      throw new Error(`Ứng dụng '${appName}' chưa được đăng ký trong Port Registry. Vui lòng cấp port trước!`);
    }

    const port = entry.port;

    // 2. Security Guardrail: Blacklist check
    if (SENSITIVE_BLACKLIST_PORTS.has(port) && !options.force) {
      throw new Error(
        `[SECURITY GUARDRAIL] Port ${port} nằm trong danh sách cổng nhạy cảm / database / debug cấm expose trực tiếp ra ngoài Internet! Dùng --force nếu bạn biết chính xác mình đang làm gì.`
      );
    }

    if (!fs.existsSync(TUNNEL_CONFIG_PATH)) {
      throw new Error(`Không tìm thấy file cấu hình Cloudflare Tunnel tại: ${TUNNEL_CONFIG_PATH}`);
    }

    // 3. Parse YAML
    const rawYaml = fs.readFileSync(TUNNEL_CONFIG_PATH, 'utf8');
    const config = yaml.parse(rawYaml);
    if (!config.ingress || !Array.isArray(config.ingress)) {
      config.ingress = [];
    }

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
    const tmpFile = `/tmp/cloudflared-validate-${Date.now()}.yml`;
    fs.writeFileSync(tmpFile, updatedYaml, 'utf8');

    try {
      // 4. Validate ingress using cloudflared CLI
      execSync(`cloudflared tunnel --config "${tmpFile}" ingress validate`, { stdio: 'pipe' });

      // 5. Write to local repo config & copy to /etc/cloudflared/config.yml
      fs.writeFileSync(TUNNEL_CONFIG_PATH, updatedYaml, 'utf8');
      execSync(`sudo cp "${TUNNEL_CONFIG_PATH}" "${SYSTEM_TUNNEL_CONFIG_PATH}"`, { stdio: 'pipe' });
      fs.unlinkSync(tmpFile);

      // 6. Create DNS CNAME on Cloudflare edge
      try {
        execSync(`cloudflared tunnel route dns githsoft-tunnels-id "${domain}"`, { stdio: 'pipe' });
      } catch (dnsErr) {
        // Ignored if already exists
      }

      // 7. Safe reload launchd daemon
      execSync('sudo launchctl kickstart -k system/com.cloudflare.cloudflared', { stdio: 'pipe' });

      // 8. Update registry metadata
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
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
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
