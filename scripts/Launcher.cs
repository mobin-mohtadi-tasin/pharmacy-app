using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace PharmaCareLauncher
{
    static class Program
    {
        private const string AppUrl = "http://localhost:3000";

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            // 1. If server is already running, open Chrome directly without showing splash
            if (IsServerOnline())
            {
                LaunchInChrome(AppUrl);
                return;
            }

            // 2. Server not running: find project root
            string appDir = FindAppDirectory();
            if (string.IsNullOrEmpty(appDir) || !File.Exists(Path.Combine(appDir, "package.json")))
            {
                MessageBox.Show(
                    "Could not find the pharmacy-app project folder.\nPlease ensure PharmaCare.exe is located inside the pharmacy billing system directory.",
                    "PharmaCare - Directory Not Found",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            // 3. Launch splash form which starts the server in background & polls until ready
            Application.Run(new SplashForm(appDir, AppUrl));
        }

        public static bool IsServerOnline()
        {
            try
            {
                var req = (HttpWebRequest)WebRequest.Create(AppUrl);
                req.Method = "GET";
                req.Timeout = 1200;
                req.ReadWriteTimeout = 1200;
                using (var res = (HttpWebResponse)req.GetResponse())
                {
                    return ((int)res.StatusCode >= 200 && (int)res.StatusCode < 500);
                }
            }
            catch
            {
                return false;
            }
        }

        public static void LaunchInChrome(string url)
        {
            string chromePath = FindChromePath();
            try
            {
                if (!string.IsNullOrEmpty(chromePath) && File.Exists(chromePath))
                {
                    // Open in Chrome
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = chromePath,
                        Arguments = "\"" + url + "\"",
                        UseShellExecute = false
                    });
                }
                else
                {
                    // Fallback to default browser
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = url,
                        UseShellExecute = true
                    });
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Failed to open Chrome: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        public static string FindChromePath()
        {
            try
            {
                using (var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"))
                {
                    if (key != null)
                    {
                        object val = key.GetValue("");
                        if (val != null && File.Exists(val.ToString()))
                            return val.ToString();
                    }
                }
            }
            catch { }

            string[] candidates = {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
            };

            foreach (var path in candidates)
            {
                if (File.Exists(path)) return path;
            }

            return null;
        }

        public static string FindAppDirectory()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');

            // Scenario A: exe is in pharmacy-app
            if (File.Exists(Path.Combine(baseDir, "package.json")))
                return baseDir;

            // Scenario B: exe is in parent folder (e.g. D:\pharmacy billing system)
            string subDir = Path.Combine(baseDir, "pharmacy-app");
            if (File.Exists(Path.Combine(subDir, "package.json")))
                return subDir;

            // Scenario C: hardcoded project path fallback
            string defaultPath = @"d:\pharmacy billing system\pharmacy-app";
            if (File.Exists(Path.Combine(defaultPath, "package.json")))
                return defaultPath;

            return null;
        }
    }

    public class SplashForm : Form
    {
        private readonly string _appDir;
        private readonly string _appUrl;
        private Label _lblStatus;
        private ProgressBar _progressBar;
        private System.Windows.Forms.Timer _pollTimer;
        private int _attempts = 0;
        private const int MaxAttempts = 80; // 80 * 500ms = 40 seconds

        public SplashForm(string appDir, string appUrl)
        {
            _appDir = appDir;
            _appUrl = appUrl;

            InitUI();
            StartServerProcess();

            _pollTimer = new System.Windows.Forms.Timer();
            _pollTimer.Interval = 500;
            _pollTimer.Tick += OnPollTick;
            _pollTimer.Start();
        }

        private void InitUI()
        {
            this.Text = "PharmaCare Launcher";
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.ClientSize = new Size(420, 160);
            this.BackColor = Color.FromArgb(245, 247, 251);

            // Try loading app icon
            try
            {
                string iconPath = Path.Combine(_appDir, @"src\app\favicon.ico");
                if (File.Exists(iconPath))
                {
                    this.Icon = new Icon(iconPath);
                }
            }
            catch { }

            Label lblTitle = new Label();
            lblTitle.Text = "PharmaCare Billing System";
            lblTitle.Font = new Font("Segoe UI", 13, FontStyle.Bold);
            lblTitle.ForeColor = Color.FromArgb(30, 41, 59);
            lblTitle.Location = new Point(24, 20);
            lblTitle.AutoSize = true;
            this.Controls.Add(lblTitle);

            _lblStatus = new Label();
            _lblStatus.Text = "Starting local server & opening Google Chrome...";
            _lblStatus.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            _lblStatus.ForeColor = Color.FromArgb(100, 116, 139);
            _lblStatus.Location = new Point(26, 52);
            _lblStatus.Size = new Size(370, 20);
            this.Controls.Add(_lblStatus);

            _progressBar = new ProgressBar();
            _progressBar.Style = ProgressBarStyle.Marquee;
            _progressBar.MarqueeAnimationSpeed = 30;
            _progressBar.Location = new Point(26, 85);
            _progressBar.Size = new Size(368, 14);
            this.Controls.Add(_progressBar);

            Label lblHint = new Label();
            lblHint.Text = "Please wait a moment while the app initializes.";
            lblHint.Font = new Font("Segoe UI", 8, FontStyle.Italic);
            lblHint.ForeColor = Color.FromArgb(148, 163, 184);
            lblHint.Location = new Point(26, 115);
            lblHint.AutoSize = true;
            this.Controls.Add(lblHint);
        }

        private void StartServerProcess()
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/c npm run dev",
                    WorkingDirectory = _appDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                Process.Start(psi);
            }
            catch (Exception ex)
            {
                if (_pollTimer != null)
                {
                    _pollTimer.Stop();
                }
                MessageBox.Show(
                    "Error launching npm server:\n" + ex.Message + "\n\nPlease ensure Node.js is installed on your computer.",
                    "PharmaCare Launch Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                this.Close();
            }
        }

        private void OnPollTick(object sender, EventArgs e)
        {
            _attempts++;

            ThreadPool.QueueUserWorkItem(_ =>
            {
                if (Program.IsServerOnline())
                {
                    this.BeginInvoke((Action)(() =>
                    {
                        _pollTimer.Stop();
                        _lblStatus.Text = "Server ready! Opening Chrome...";
                        Program.LaunchInChrome(_appUrl);
                        this.Close();
                    }));
                }
                else if (_attempts >= MaxAttempts)
                {
                    this.BeginInvoke((Action)(() =>
                    {
                        _pollTimer.Stop();
                        MessageBox.Show(
                            "The server took too long to respond.\nIf this is the first run, Next.js may need extra time to compile.\n\nPlease check that port 3000 is available and try again.",
                            "PharmaCare - Timeout",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Warning
                        );
                        this.Close();
                    }));
                }
            });
        }
    }
}
