using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace PharmaCareLauncher
{
    static class Program
    {
        private static Job _job;
        private static Process _nodeProcess;
        private static Process _browserProcess;

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            try
            {
                _job = new Job();
            }
            catch { }

            // 1. Determine directories & runtime
            string baseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');

            string nodeExe = FindNodeExecutable(baseDir);
            if (string.IsNullOrEmpty(nodeExe))
            {
                MessageBox.Show(
                    "Node.js runtime was not found.\n\nPlease ensure this application folder is complete.",
                    "PharmaCare - Missing Runtime",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            string appDir = "";
            bool isStandalone = false;

            if (File.Exists(Path.Combine(baseDir, "server.js")))
            {
                appDir = baseDir;
                isStandalone = true;
            }
            else if (File.Exists(Path.Combine(baseDir, @"app\server.js")))
            {
                appDir = Path.Combine(baseDir, "app");
                isStandalone = true;
            }
            else if (File.Exists(Path.Combine(baseDir, @"pharmacy-app\.next\standalone\server.js")))
            {
                appDir = Path.Combine(baseDir, @"pharmacy-app\.next\standalone");
                isStandalone = true;
            }
            else if (File.Exists(Path.Combine(baseDir, "package.json")))
            {
                appDir = baseDir;
                isStandalone = false;
            }
            else if (File.Exists(Path.Combine(baseDir, @"pharmacy-app\package.json")))
            {
                appDir = Path.Combine(baseDir, "pharmacy-app");
                isStandalone = false;
            }
            else
            {
                MessageBox.Show(
                    "Could not locate the PharmaCare application files.\nPlease ensure the folder contents were extracted properly.",
                    "PharmaCare - Files Not Found",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            int port = GetAvailablePort(3000);
            string appUrl = "http://localhost:" + port;

            // Run splash screen which starts the server, launches browser, and monitors lifecycle
            Application.Run(new AppRunnerForm(baseDir, appDir, nodeExe, isStandalone, port, appUrl, _job));
        }

        public static int GetAvailablePort(int startPort)
        {
            for (int p = startPort; p < startPort + 50; p++)
            {
                try
                {
                    TcpListener l = new TcpListener(IPAddress.Loopback, p);
                    l.Start();
                    l.Stop();
                    return p;
                }
                catch { }
            }
            return startPort;
        }

        public static string FindNodeExecutable(string baseDir)
        {
            string[] relativeChecks = {
                Path.Combine(baseDir, "node.exe"),
                Path.Combine(baseDir, @"runtime\node.exe"),
                Path.Combine(baseDir, @"bin\node.exe")
            };

            foreach (string p in relativeChecks)
            {
                if (File.Exists(p)) return p;
            }

            // Check system PATH
            string[] systemPaths = {
                @"C:\Program Files\nodejs\node.exe",
                @"C:\Program Files (x86)\nodejs\node.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\node\node.exe")
            };

            foreach (string p in systemPaths)
            {
                if (File.Exists(p)) return p;
            }

            return null;
        }

        public static string FindBrowserPath()
        {
            // 1. Google Chrome (preferred)
            try
            {
                using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"))
                {
                    if (key != null)
                    {
                        object val = key.GetValue("");
                        if (val != null && File.Exists(val.ToString())) return val.ToString();
                    }
                }
            }
            catch { }

            string[] chromePaths = {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
            };

            foreach (string p in chromePaths)
            {
                if (File.Exists(p)) return p;
            }

            // 2. Microsoft Edge (fallback - preinstalled on Windows 10/11)
            try
            {
                using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe"))
                {
                    if (key != null)
                    {
                        object val = key.GetValue("");
                        if (val != null && File.Exists(val.ToString())) return val.ToString();
                    }
                }
            }
            catch { }

            string[] edgePaths = {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe")
            };

            foreach (string p in edgePaths)
            {
                if (File.Exists(p)) return p;
            }

            return null;
        }

        public static bool CheckServerReady(string url)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Method = "GET";
                req.Timeout = 800;
                req.ReadWriteTimeout = 800;
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    return ((int)res.StatusCode >= 200 && (int)res.StatusCode < 500);
                }
            }
            catch
            {
                return false;
            }
        }
    }

    public class AppRunnerForm : Form
    {
        private readonly string _baseDir;
        private readonly string _appDir;
        private readonly string _nodeExe;
        private readonly bool _isStandalone;
        private readonly int _port;
        private readonly string _appUrl;
        private readonly Job _job;

        private Process _nodeProc;
        private Process _browserProc;
        private System.Windows.Forms.Timer _pollTimer;
        private int _pollAttempts = 0;
        private const int MaxAttempts = 60; // 30 seconds max
        private bool _isClosing = false;

        private Label _lblStatus;
        private ProgressBar _progressBar;

        public AppRunnerForm(string baseDir, string appDir, string nodeExe, bool isStandalone, int port, string appUrl, Job job)
        {
            _baseDir = baseDir;
            _appDir = appDir;
            _nodeExe = nodeExe;
            _isStandalone = isStandalone;
            _port = port;
            _appUrl = appUrl;
            _job = job;

            InitUI();
            StartBackendServer();

            _pollTimer = new System.Windows.Forms.Timer();
            _pollTimer.Interval = 400;
            _pollTimer.Tick += OnPollTick;
            _pollTimer.Start();
        }

        private void InitUI()
        {
            this.Text = "PharmaCare";
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.ClientSize = new Size(390, 150);
            this.BackColor = Color.FromArgb(248, 250, 252);

            try
            {
                string iconPath = Path.Combine(_baseDir, "favicon.ico");
                if (!File.Exists(iconPath))
                    iconPath = Path.Combine(_appDir, @"public\favicon.ico");
                if (File.Exists(iconPath))
                    this.Icon = new Icon(iconPath);
            }
            catch { }

            Label lblTitle = new Label();
            lblTitle.Text = "PharmaCare Billing System";
            lblTitle.Font = new Font("Segoe UI", 12, FontStyle.Bold);
            lblTitle.ForeColor = Color.FromArgb(15, 23, 42);
            lblTitle.Location = new Point(22, 18);
            lblTitle.AutoSize = true;
            this.Controls.Add(lblTitle);

            _lblStatus = new Label();
            _lblStatus.Text = "Starting system...";
            _lblStatus.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            _lblStatus.ForeColor = Color.FromArgb(100, 116, 139);
            _lblStatus.Location = new Point(24, 48);
            _lblStatus.Size = new Size(340, 20);
            this.Controls.Add(_lblStatus);

            _progressBar = new ProgressBar();
            _progressBar.Style = ProgressBarStyle.Marquee;
            _progressBar.MarqueeAnimationSpeed = 25;
            _progressBar.Location = new Point(24, 76);
            _progressBar.Size = new Size(342, 12);
            this.Controls.Add(_progressBar);

            Label lblHint = new Label();
            lblHint.Text = "App will open in a window. Closing the window exits the app.";
            lblHint.Font = new Font("Segoe UI", 8, FontStyle.Regular);
            lblHint.ForeColor = Color.FromArgb(148, 163, 184);
            lblHint.Location = new Point(24, 105);
            lblHint.AutoSize = true;
            this.Controls.Add(lblHint);
        }

        private void StartBackendServer()
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.WorkingDirectory = _appDir;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.WindowStyle = ProcessWindowStyle.Hidden;

                // Ensure data directory exists
                string dataDir = Path.Combine(_appDir, "data");
                if (!Directory.Exists(dataDir))
                {
                    try { Directory.CreateDirectory(dataDir); } catch { }
                }

                psi.EnvironmentVariables["PORT"] = _port.ToString();
                psi.EnvironmentVariables["NODE_ENV"] = "production";
                psi.EnvironmentVariables["DB_PATH"] = Path.Combine(dataDir, "pharmacy.db");

                if (_isStandalone)
                {
                    psi.FileName = _nodeExe;
                    psi.Arguments = "server.js";
                }
                else
                {
                    psi.FileName = "cmd.exe";
                    psi.Arguments = "/c npm run dev";
                }

                _nodeProc = Process.Start(psi);

                if (_job != null && _nodeProc != null)
                {
                    try { _job.AddProcess(_nodeProc.Handle); } catch { }
                }
            }
            catch (Exception ex)
            {
                _pollTimer.Stop();
                MessageBox.Show(
                    "Failed to start the application server:\n" + ex.Message,
                    "PharmaCare Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                CleanupAndExit();
            }
        }

        private void OnPollTick(object sender, EventArgs e)
        {
            _pollAttempts++;

            ThreadPool.QueueUserWorkItem(_ =>
            {
                if (Program.CheckServerReady(_appUrl))
                {
                    this.BeginInvoke((Action)(() =>
                    {
                        _pollTimer.Stop();
                        LaunchAppWindow();
                    }));
                }
                else if (_pollAttempts >= MaxAttempts)
                {
                    this.BeginInvoke((Action)(() =>
                    {
                        _pollTimer.Stop();
                        MessageBox.Show(
                            "The system server did not respond in time.\nPlease try launching again.",
                            "PharmaCare Timeout",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Warning
                        );
                        CleanupAndExit();
                    }));
                }
            });
        }

        private void LaunchAppWindow()
        {
            string browserPath = Program.FindBrowserPath();
            string profileDir = Path.Combine(_baseDir, @"data\profile");
            try { Directory.CreateDirectory(profileDir); } catch { }

            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                if (!string.IsNullOrEmpty(browserPath) && File.Exists(browserPath))
                {
                    psi.FileName = browserPath;
                    psi.Arguments = "--app=\"" + _appUrl + "\" --user-data-dir=\"" + profileDir + "\" --no-first-run --no-default-browser-check";
                    psi.UseShellExecute = false;
                }
                else
                {
                    // Fallback to standard URL launch
                    psi.FileName = _appUrl;
                    psi.UseShellExecute = true;
                }

                _browserProc = Process.Start(psi);

                if (_job != null && _browserProc != null)
                {
                    try { _job.AddProcess(_browserProc.Handle); } catch { }
                }

                // Hide the launcher window from view and taskbar
                this.Hide();
                this.ShowInTaskbar = false;

                // Monitor the browser process in a background thread
                ThreadPool.QueueUserWorkItem(_ =>
                {
                    if (_browserProc != null)
                    {
                        try
                        {
                            _browserProc.WaitForExit();
                        }
                        catch { }
                    }

                    // User closed the window! Clean up and exit completely
                    this.BeginInvoke((Action)(() =>
                    {
                        CleanupAndExit();
                    }));
                });
            }
            catch (Exception ex)
            {
                MessageBox.Show("Could not launch app window: " + ex.Message, "PharmaCare Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                CleanupAndExit();
            }
        }

        private void CleanupAndExit()
        {
            if (_isClosing) return;
            _isClosing = true;

            if (_pollTimer != null)
            {
                _pollTimer.Stop();
                _pollTimer.Dispose();
            }

            // Terminate backend node server
            try
            {
                if (_nodeProc != null && !_nodeProc.HasExited)
                {
                    KillProcessTree(_nodeProc.Id);
                }
            }
            catch { }

            try
            {
                if (_job != null) _job.Dispose();
            }
            catch { }

            Application.Exit();
        }

        private void KillProcessTree(int pid)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "taskkill.exe",
                    Arguments = "/F /T /PID " + pid,
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                Process p = Process.Start(psi);
                p.WaitForExit(2000);
            }
            catch { }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            base.OnFormClosing(e);
            CleanupAndExit();
        }
    }

    public class Job : IDisposable
    {
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

        [DllImport("kernel32.dll")]
        static extern bool SetInformationJobObject(IntPtr hJob, int JobObjectInfoClass, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        static extern bool CloseHandle(IntPtr hObject);

        private IntPtr handle;
        private bool disposed;

        public Job()
        {
            handle = CreateJobObject(IntPtr.Zero, null);
            var info = new JOBOBJECT_BASIC_LIMIT_INFORMATION
            {
                LimitFlags = 0x2000 // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            };
            var extendedInfo = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION
            {
                BasicLimitInformation = info
            };
            int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
            IntPtr extendedInfoPtr = Marshal.AllocHGlobal(length);
            try
            {
                Marshal.StructureToPtr(extendedInfo, extendedInfoPtr, false);
                SetInformationJobObject(handle, 9, extendedInfoPtr, (uint)length);
            }
            finally
            {
                Marshal.FreeHGlobal(extendedInfoPtr);
            }
        }

        public void AddProcess(IntPtr processHandle)
        {
            if (handle != IntPtr.Zero)
            {
                AssignProcessToJobObject(handle, processHandle);
            }
        }

        public void Dispose()
        {
            if (!disposed)
            {
                if (handle != IntPtr.Zero)
                {
                    CloseHandle(handle);
                    handle = IntPtr.Zero;
                }
                disposed = true;
            }
        }

        [StructLayout(LayoutKind.Sequential)]
        struct JOBOBJECT_BASIC_LIMIT_INFORMATION
        {
            public Int64 PerProcessUserTimeLimit;
            public Int64 PerJobUserTimeLimit;
            public UInt32 LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public UInt32 ActiveProcessLimit;
            public UIntPtr Affinity;
            public UInt32 PriorityClass;
            public UInt32 SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct IO_COUNTERS
        {
            public UInt64 ReadOperationCount;
            public UInt64 WriteOperationCount;
            public UInt64 OtherOperationCount;
            public UInt64 ReadTransferCount;
            public UInt64 WriteTransferCount;
            public UInt64 OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
        {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public IO_COUNTERS IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryLimit;
            public UIntPtr PeakJobMemoryLimit;
        }
    }
}
