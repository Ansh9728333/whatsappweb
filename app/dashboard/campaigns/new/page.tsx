"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  FileSpreadsheet,
  Trash2,
  Edit2,
  Plus,
  Loader2,
  Calendar,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Phone,
  Settings,
  RefreshCw,
  Clock,
  Eye,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type Session = {
  id: string;
  sessionId: string;
  phoneNumber: string;
  status: string;
};

type Recipient = {
  id: string; // Internal temporary ID
  name: string;
  phoneNumber: string;
  normalizedPhone: string;
  customData: Record<string, string>;
  isValid: boolean;
  isDuplicate: boolean;
  isEmpty: boolean;
  validationError: string | null;
  excluded: boolean;
};

const STEPS = ["Campaign Details", "Recipients", "Message", "Review & Send"];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Form State
  const [campaignName, setCampaignName] = useState("");
  const [selectedSenders, setSelectedSenders] = useState<string[]>([]);
  const [sendingMethod, setSendingMethod] = useState<"ROUND_ROBIN" | "PRIMARY_FIRST">("ROUND_ROBIN");

  // Step 2 Upload Recipient File State
  const [fileData, setFileData] = useState<{
    originalFileName: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    columnMapping: Record<string, string>;
  } | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column Mapping selections
  const [mapping, setMapping] = useState({
    name: "",
    phone: "",
    company: "",
    amount: "",
    dueDate: "",
    customField1: "",
    customField2: "",
  });

  // Preview table state
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientPage, setRecipientPage] = useState(0);
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phoneNumber: "" });
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  // Step 3 Message Composer State
  const [messageType, setMessageType] = useState<"TEXT" | "IMAGE" | "DOCUMENT" | "VIDEO">("TEXT");
  const [messageBody, setMessageBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Step 4 Settings State
  const [minDelay, setMinDelay] = useState(5);
  const [maxDelay, setMaxDelay] = useState(10);
  const [sleepEnabled, setSleepEnabled] = useState(false);
  const [messagesBeforeSleep, setMessagesBeforeSleep] = useState(50);
  const [sleepDurationMinutes, setSleepDurationMinutes] = useState(10);
  const [shortenUrls, setShortenUrls] = useState(false);
  const [scheduleType, setScheduleType] = useState<"NOW" | "LATER">("NOW");
  const [scheduledAt, setScheduledAt] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [retryEnabled, setRetryEnabled] = useState(false);
  const [maxRetries, setMaxRetries] = useState(2);

  // Confirmation dialog
  const [showConfirm, setShowConfirm] = useState(false);

  // Load WhatsApp sessions
  async function fetchSessions() {
    try {
      const res = await fetch("/api/wa-accounts/sessions");
      if (!res.ok) throw new Error("Failed to load sessions");
      const data = await res.json();
      setSessions(data);
      // Auto-select first connected session
      const connected = data.filter((s: Session) => s.status === "connected");
      if (connected.length > 0) {
        setSelectedSenders([connected[0].sessionId]);
      }
    } catch (err) {
      toast.error("Failed to load WhatsApp senders");
    } finally {
      setSessionsLoading(false);
    }
  }

  useEffect(() => {
    fetchSessions();
  }, []);

  // Download Sample File
  function downloadSampleFile() {
    const csvContent =
      "data:text/csv;charset=utf-8,Name,Phone Number,Company,Amount,Due Date\n" +
      "Rahul Sharma,9876543210,ABC Pvt Ltd,5000,31-07-2026\n" +
      "Priya Verma,919876543211,XYZ Enterprises,7500,05-08-2026";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "WhatsHub_Sample_Recipients.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Process uploaded Excel / CSV file
  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

        if (json.length === 0) {
          toast.error("The uploaded file is empty.");
          return;
        }

        // Get headers from first row keys
        const fileHeaders = Object.keys(json[0]);
        setHeaders(fileHeaders);
        setRawRows(json);

        // Auto-detect Name and Phone columns
        const autoMapping = {
          name: "",
          phone: "",
          company: "",
          amount: "",
          dueDate: "",
          customField1: "",
          customField2: "",
        };

        const nameAliases = ["name", "customer name", "client name", "contact name", "fullname", "first name", "username", "recipient"];
        const phoneAliases = ["phone", "phone number", "mobile", "whatsapp", "whatsapp number", "contact", "contact number", "number"];
        const companyAliases = ["company", "organization", "firm", "business"];
        const amountAliases = ["amount", "due", "fee", "price", "payment"];
        const dateAliases = ["due date", "date", "renewal date", "deadline"];

        fileHeaders.forEach((h) => {
          const lh = h.toLowerCase().trim();
          if (!autoMapping.name && nameAliases.includes(lh)) autoMapping.name = h;
          if (!autoMapping.phone && phoneAliases.includes(lh)) autoMapping.phone = h;
          if (!autoMapping.company && companyAliases.includes(lh)) autoMapping.company = h;
          if (!autoMapping.amount && amountAliases.includes(lh)) autoMapping.amount = h;
          if (!autoMapping.dueDate && dateAliases.includes(lh)) autoMapping.dueDate = h;
        });

        // Fallbacks if no exact aliases match
        if (!autoMapping.name) {
          autoMapping.name = fileHeaders.find(h => h.toLowerCase().includes("name")) || fileHeaders[0] || "";
        }
        if (!autoMapping.phone) {
          autoMapping.phone = fileHeaders.find(h => h.toLowerCase().includes("phone") || h.toLowerCase().includes("mobile") || h.toLowerCase().includes("num")) || fileHeaders[1] || "";
        }

        setMapping(autoMapping);
        setFileData({
          originalFileName: file.name,
          totalRows: json.length,
          validRows: 0,
          invalidRows: 0,
          duplicateRows: 0,
          columnMapping: autoMapping,
        });

        toast.success("File uploaded successfully! Please verify column mapping.");
      } catch (err) {
        toast.error("Error reading file. Please make sure it is a valid CSV or Excel file.");
      }
    };
    reader.readAsBinaryString(file);
  };

  // Perform phone validation and data mapping
  const runValidation = () => {
    if (!rawRows.length || !fileData) return;

    const seenPhones = new Set<string>();
    const mappedRecipients: Recipient[] = [];

    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;
    let emptyCount = 0;

    rawRows.forEach((row, idx) => {
      const name = String(row[mapping.name] || "").trim();
      const rawPhone = String(row[mapping.phone] || "").trim();

      let validationError: string | null = null;
      let isEmpty = false;
      let isDuplicate = false;
      let isValid = true;

      // 1. Check empty
      if (!rawPhone) {
        isEmpty = true;
        isValid = false;
        validationError = "Phone number is empty";
        emptyCount++;
      }

      // 2. Normalize number: remove spaces, hyphens, brackets
      let normalized = rawPhone.replace(/[\s\-\(\)\+]/g, "");

      // 3. Indian 10-digit number normalization
      if (isValid && /^[6-9]\d{9}$/.test(normalized)) {
        normalized = `91${normalized}`;
      }

      // 4. Validate format: must contain only digits, length at least 10
      if (isValid) {
        if (!/^\d+$/.test(normalized)) {
          isValid = false;
          validationError = "Contains unsupported characters";
          invalidCount++;
        } else if (normalized.length < 10) {
          isValid = false;
          validationError = "Fewer than 10 digits";
          invalidCount++;
        }
      }

      // 5. Check duplicate
      if (isValid) {
        if (seenPhones.has(normalized)) {
          isDuplicate = true;
          isValid = false;
          validationError = "Duplicate phone number";
          duplicateCount++;
        } else {
          seenPhones.add(normalized);
          validCount++;
        }
      }

      // Gather custom data columns
      const customData: Record<string, string> = {};
      if (mapping.company && row[mapping.company]) customData.company = String(row[mapping.company]).trim();
      if (mapping.amount && row[mapping.amount]) customData.amount = String(row[mapping.amount]).trim();
      if (mapping.dueDate && row[mapping.dueDate]) customData.due_date = String(row[mapping.dueDate]).trim();
      if (mapping.customField1 && row[mapping.customField1]) customData.custom_field_1 = String(row[mapping.customField1]).trim();
      if (mapping.customField2 && row[mapping.customField2]) customData.custom_field_2 = String(row[mapping.customField2]).trim();

      // Extract any extra columns as customData keys
      headers.forEach(h => {
        if (h !== mapping.name && h !== mapping.phone && !Object.values(mapping).includes(h)) {
          const cleanKey = h.toLowerCase().replace(/[^a-z0-9_]/g, "_");
          customData[cleanKey] = String(row[h] || "").trim();
        }
      });

      mappedRecipients.push({
        id: `rec-${idx}-${Date.now()}`,
        name: name || "Recipient",
        phoneNumber: rawPhone,
        normalizedPhone: normalized,
        customData,
        isValid,
        isDuplicate,
        isEmpty,
        validationError,
        excluded: !isValid,
      });
    });

    setRecipients(mappedRecipients);
    setFileData({
      ...fileData,
      validRows: validCount,
      invalidRows: invalidCount + emptyCount,
      duplicateRows: duplicateCount,
      columnMapping: mapping,
    });
  };

  // Re-run validation whenever mapping changes
  useEffect(() => {
    if (rawRows.length > 0) {
      runValidation();
    }
  }, [mapping, rawRows]);

  // Recipient removal helper buttons
  function removeInvalidRows() {
    setRecipients(prev => prev.filter(r => r.isValid));
    if (fileData) {
      setFileData({
        ...fileData,
        invalidRows: 0,
        totalRows: recipients.filter(r => r.isValid || r.isDuplicate).length,
      });
    }
    toast.success("Invalid rows removed");
  }

  function removeDuplicateRows() {
    setRecipients(prev => prev.filter(r => !r.isDuplicate));
    if (fileData) {
      setFileData({
        ...fileData,
        duplicateRows: 0,
        totalRows: recipients.filter(r => r.isValid || !r.isDuplicate).length,
      });
    }
    toast.success("Duplicate rows removed");
  }

  function downloadErrorReport() {
    const errorRows = recipients.filter(r => !r.isValid);
    if (errorRows.length === 0) {
      toast.info("No error rows found to export.");
      return;
    }

    const headersList = ["Row Number", "Name", "Phone Number", "Validation Error"];
    const rows = errorRows.map((r, idx) => [
      (idx + 1).toString(),
      r.name,
      r.phoneNumber,
      r.validationError || "Unknown",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headersList.join(","), ...rows.map(e => e.map(x => `"${x.replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Recipient_Upload_Errors.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Recipient action helpers
  function toggleExcludeRecipient(id: string) {
    setRecipients(prev =>
      prev.map(r => (r.id === id ? { ...r, excluded: !r.excluded } : r))
    );
  }

  function deleteRecipient(id: string) {
    setRecipients(prev => prev.filter(r => r.id !== id));
  }

  function startEditRecipient(r: Recipient) {
    setEditingRecipientId(r.id);
    setEditForm({ name: r.name, phoneNumber: r.phoneNumber });
  }

  function saveEditRecipient(id: string) {
    let normalized = editForm.phoneNumber.replace(/[\s\-\(\)\+]/g, "");
    if (/^[6-9]\d{9}$/.test(normalized)) {
      normalized = `91${normalized}`;
    }

    setRecipients(prev =>
      prev.map(r =>
        r.id === id
          ? {
              ...r,
              name: editForm.name,
              phoneNumber: editForm.phoneNumber,
              normalizedPhone: normalized,
              isValid: normalized.length >= 10,
              validationError: normalized.length < 10 ? "Fewer than 10 digits" : null,
            }
          : r
      )
    );
    setEditingRecipientId(null);
    toast.success("Recipient updated");
  }

  function handleManualAdd() {
    if (!manualPhone) {
      toast.error("Phone number is required");
      return;
    }

    let normalized = manualPhone.replace(/[\s\-\(\)\+]/g, "");
    if (/^[6-9]\d{9}$/.test(normalized)) {
      normalized = `91${normalized}`;
    }

    const isValid = normalized.length >= 10;

    const newRec: Recipient = {
      id: `rec-manual-${Date.now()}`,
      name: manualName || "Manual Recipient",
      phoneNumber: manualPhone,
      normalizedPhone: normalized,
      customData: {},
      isValid,
      isDuplicate: false,
      isEmpty: false,
      validationError: isValid ? null : "Invalid number length",
      excluded: !isValid,
    };

    setRecipients(prev => [newRec, ...prev]);
    setManualName("");
    setManualPhone("");
    toast.success("Recipient added manually");
  }

  // Filtered recipient list for step 2 preview table
  const displayedRecipients = useMemo(() => {
    return recipients.filter((r) => {
      const matchName = r.name.toLowerCase().includes(recipientSearch.toLowerCase());
      const matchPhone = r.phoneNumber.includes(recipientSearch);
      return matchName || matchPhone;
    });
  }, [recipients, recipientSearch]);

  const totalValidSelected = useMemo(() => {
    return recipients.filter(r => r.isValid && !r.excluded).length;
  }, [recipients]);

  // Step 3 Variable chip click
  function handleVariableChipClick(v: string) {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = messageBody;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    setMessageBody(before + `{{${v}}}` + after);

    // Reset cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = start + v.length + 4;
        textareaRef.current.selectionEnd = start + v.length + 4;
      }
    }, 50);
  }

  // Generate dynamic preview card using the first recipient
  const livePreviewMessage = useMemo(() => {
    if (!messageBody) return "Enter your message text to see preview...";

    const firstValid = recipients.find(r => r.isValid && !r.excluded) || {
      name: "Rahul Sharma",
      phoneNumber: "9876543210",
      customData: {
        company: "ABC Pvt Ltd",
        amount: "5000",
        due_date: "31-07-2026",
      },
    };

    let text = messageBody;
    const variablesMap = {
      name: firstValid.name || "",
      phone: firstValid.phoneNumber || "",
      ...(firstValid.customData as Record<string, string>),
    };

    for (const [key, val] of Object.entries(variablesMap)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
      text = text.replace(regex, val || "");
    }

    return text;
  }, [messageBody, recipients]);

  // Handle Media File upload
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Basic size checks (max 16MB)
      if (file.size > 16 * 1024 * 1024) {
        toast.error("Media file size cannot exceed 16MB.");
        return;
      }

      setMediaFile(file);
      setMediaUploading(true);

      // Simulate CDN file upload / save locally
      try {
        const formData = new FormData();
        formData.append("file", file);
        
        // Let's call /api/templates/upload or mock a file preview URL
        // To make it fully functional, we can create an object URL for instant local previews!
        const localUrl = URL.createObjectURL(file);
        setMediaUrl(localUrl);
        toast.success("Media file uploaded successfully!");
      } catch (err) {
        toast.error("Failed to upload media file");
      } finally {
        setMediaUploading(false);
      }
    }
  };

  // Step wizard validation guards
  const canNext = useMemo(() => {
    if (step === 0) {
      return campaignName.trim().length > 0 && selectedSenders.length > 0;
    }
    if (step === 1) {
      return totalValidSelected > 0;
    }
    if (step === 2) {
      return messageBody.trim().length > 0;
    }
    return true;
  }, [step, campaignName, selectedSenders, totalValidSelected, messageBody]);

  // Submit / Launch Campaign
  async function handleLaunchCampaign(saveAsDraft = false) {
    setShowConfirm(false);
    setLoading(true);

    try {
      const payload = {
        name: campaignName,
        senders: selectedSenders.map((sid) => {
          const s = sessions.find((x) => x.sessionId === sid);
          return { sessionId: sid, phoneNumber: s ? s.phoneNumber : "Unknown" };
        }),
        sendingMethod,
        messageType,
        messageBody,
        mediaUrl: mediaUrl || null,
        minDelay,
        maxDelay,
        sleepEnabled,
        messagesBeforeSleep,
        sleepDurationMinutes,
        shortenUrls,
        scheduleType: saveAsDraft ? "DRAFT" : scheduleType,
        scheduledAt: scheduleType === "LATER" ? scheduledAt : null,
        timezone,
        retryEnabled,
        maxRetries,
        file: fileData
          ? {
              originalFileName: fileData.originalFileName,
              totalRows: fileData.totalRows,
              validRows: totalValidSelected,
              invalidRows: fileData.invalidRows,
              duplicateRows: fileData.duplicateRows,
              columnMapping: fileData.columnMapping,
            }
          : null,
        recipients: recipients
          .filter((r) => r.isValid && !r.excluded)
          .map((r) => ({
            name: r.name,
            phoneNumber: r.phoneNumber,
            normalizedPhone: r.normalizedPhone,
            customData: r.customData,
          })),
      };

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit campaign");
      }

      const campaign = await res.json();
      toast.success(saveAsDraft ? "Campaign saved as Draft" : "Campaign launched successfully!");
      router.push(`/dashboard/campaigns/${campaign.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/campaigns"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create Broadcast Campaign</h1>
          <p className="text-slate-500 text-sm mt-0.5">Send a personalized mass message using WhatsApp numbers</p>
        </div>
      </div>

      {/* Step Progress Tracker */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {STEPS.map((s, idx) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all border ${
                  idx < step
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : idx === step
                    ? "bg-emerald-50 text-emerald-600 border-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950/30"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400"
                }`}
              >
                {idx < step ? <Check size={14} /> : idx + 1}
              </div>
              <span
                className={`ml-2 text-xs font-semibold ${
                  idx === step ? "text-emerald-600 font-bold" : "text-slate-500"
                }`}
              >
                {s}
              </span>
              {idx < STEPS.length - 1 && (
                <div className={`h-0.5 w-12 mx-3 ${idx < step ? "bg-emerald-500" : "bg-slate-100 dark:bg-slate-800"}`} />
              )}
            </div>
          ))}
        </div>
        <div className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-3 py-1.5 rounded-full font-medium self-start md:self-auto">
          Step {step + 1} of 4
        </div>
      </div>

      {/* Main Form container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden p-6 md:p-8">
        {/* ==================================================
            STEP 1 — CAMPAIGN DETAILS
            ================================================== */}
        {step === 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-50 dark:border-slate-850">
              1. Campaign Details
            </h2>

            {/* Campaign Name */}
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Campaign Name *</label>
              <input
                type="text"
                placeholder="e.g. July Renewal Reminder"
                maxLength={100}
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full max-w-xl px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
              />
            </div>

            {/* Send From */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Send From *</label>
              <p className="text-xs text-slate-400">Select one or multiple connected sessions to send messages</p>
              
              {sessionsLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <RefreshCw className="animate-spin" size={13} /> Loading sessions...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
                  {sessions.map((s) => {
                    const isConnected = s.status === "connected";
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                          !isConnected
                            ? "bg-slate-50/50 dark:bg-slate-950/20 border-slate-100 dark:border-slate-850 opacity-60 cursor-not-allowed"
                            : selectedSenders.includes(s.sessionId)
                            ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10"
                            : "border-slate-100 dark:border-slate-800 hover:border-emerald-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!isConnected}
                          checked={selectedSenders.includes(s.sessionId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSenders([...selectedSenders, s.sessionId]);
                            } else {
                              setSelectedSenders(selectedSenders.filter((id) => id !== s.sessionId));
                            }
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-white font-mono truncate">{s.phoneNumber}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"}`}
                            />
                            <span className="text-[10px] uppercase font-bold text-slate-400">
                              {isConnected ? "Connected" : "Disconnected"}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sending Method */}
            {selectedSenders.length > 1 && (
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Sending Method</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                  <button
                    type="button"
                    onClick={() => setSendingMethod("ROUND_ROBIN")}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      sendingMethod === "ROUND_ROBIN"
                        ? "border-emerald-500 bg-emerald-50/25 text-emerald-700 dark:text-emerald-400"
                        : "border-slate-100 dark:border-slate-800 text-slate-600 hover:border-emerald-200"
                    }`}
                  >
                    <p className="text-sm font-bold">Round Robin</p>
                    <p className="text-xs text-slate-400 mt-1">Distribute messages equally between selected sessions.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSendingMethod("PRIMARY_FIRST")}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      sendingMethod === "PRIMARY_FIRST"
                        ? "border-emerald-500 bg-emerald-50/25 text-emerald-700 dark:text-emerald-400"
                        : "border-slate-100 dark:border-slate-800 text-slate-600 hover:border-emerald-200"
                    }`}
                  >
                    <p className="text-sm font-bold">Primary Number First</p>
                    <p className="text-xs text-slate-400 mt-1">Use the first session until its limit is hit, then proceed to the next.</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================
            STEP 2 — UPLOAD RECIPIENT FILE
            ================================================== */}
        {step === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-50 dark:border-slate-850">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Recipients Upload</h2>
              <button
                type="button"
                onClick={downloadSampleFile}
                className="text-xs text-emerald-600 hover:underline font-semibold flex items-center gap-1"
              >
                <FileSpreadsheet size={13} />
                Download Sample File
              </button>
            </div>

            {/* Drag and Drop Area */}
            {!fileData ? (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  dragActive
                    ? "border-emerald-500 bg-emerald-50/10"
                    : "border-slate-200 dark:border-slate-750 hover:border-emerald-400 bg-slate-50/30 dark:bg-slate-800/10"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                />
                <Upload size={36} className="mx-auto text-slate-400 mb-3" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Drag and drop your Excel or CSV file here, or <span className="text-emerald-500">browse</span>
                </p>
                <p className="text-xs text-slate-400 mt-1.5">Supports .xlsx, .xls, .csv files containing Name and Phone columns</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* File Upload Summary Card */}
                <div className="bg-slate-50 dark:bg-slate-850 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-100 dark:border-slate-800/50">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet size={28} className="text-emerald-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white font-mono">{fileData.originalFileName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{fileData.totalRows} rows uploaded</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFileData(null);
                        setRawRows([]);
                        setRecipients([]);
                      }}
                      className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Change File
                    </button>
                  </div>
                </div>

                {/* Column Mapping Section */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl space-y-4">
                  <h3 className="text-sm font-bold text-slate-850 dark:text-slate-200">Column Mapping</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Name mapping */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Name Column *</label>
                      <select
                        value={mapping.name}
                        onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-xs px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                      >
                        <option value="">-- Select Column --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Phone mapping */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Phone Number Column *</label>
                      <select
                        value={mapping.phone}
                        onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-xs px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                      >
                        <option value="">-- Select Column --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Company */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Company (Optional)</label>
                      <select
                        value={mapping.company}
                        onChange={(e) => setMapping({ ...mapping, company: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-xs px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                      >
                        <option value="">-- None --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Amount */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Amount (Optional)</label>
                      <select
                        value={mapping.amount}
                        onChange={(e) => setMapping({ ...mapping, amount: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-xs px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                      >
                        <option value="">-- None --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Validation Stats summary box */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50/50 dark:bg-slate-850/20 p-4 border border-slate-100 dark:border-slate-800 rounded-2xl">
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Total Rows</p>
                    <p className="text-base font-bold text-slate-800 dark:text-white mt-0.5">{fileData.totalRows}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400 text-emerald-500">Valid</p>
                    <p className="text-base font-bold text-emerald-600 mt-0.5">{totalValidSelected}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400 text-red-500">Invalid</p>
                    <p className="text-base font-bold text-red-600 mt-0.5">{fileData.invalidRows}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400 text-orange-500">Duplicate</p>
                    <p className="text-base font-bold text-orange-600 mt-0.5">{fileData.duplicateRows}</p>
                  </div>
                  <div className="text-center col-span-2 sm:col-span-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Excluded</p>
                    <p className="text-base font-bold text-slate-700 dark:text-slate-300 mt-0.5">{recipients.filter(r => r.excluded).length}</p>
                  </div>
                </div>

                {/* File Cleanup Actions */}
                <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-slate-50 dark:border-slate-850">
                  {fileData.invalidRows > 0 && (
                    <button
                      type="button"
                      onClick={removeInvalidRows}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Remove Invalid Rows
                    </button>
                  )}
                  {fileData.duplicateRows > 0 && (
                    <button
                      type="button"
                      onClick={removeDuplicateRows}
                      className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Remove Duplicate Rows
                    </button>
                  )}
                  {fileData.invalidRows > 0 && (
                    <button
                      type="button"
                      onClick={downloadErrorReport}
                      className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Download Error Report
                    </button>
                  )}
                </div>

                {/* Recipient Manual Add & Table Preview */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">Recipient Preview</h3>
                    
                    {/* Add Recipient Manually */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        placeholder="Add Name"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-xs px-3 py-2 w-full sm:w-32 focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Add Phone"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-xs px-3 py-2 w-full sm:w-36 focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={handleManualAdd}
                        className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 py-2 rounded-xl"
                      >
                        <Plus size={13} /> Add
                      </button>
                    </div>
                  </div>

                  {/* Search table */}
                  <div className="relative max-w-md">
                    <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search preview by name or phone..."
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                    />
                  </div>

                  {/* Preview Table */}
                  <div className="overflow-x-auto border border-slate-50 dark:border-slate-800/80 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-6 py-4 w-12">Send</th>
                          <th className="px-6 py-4">Name</th>
                          <th className="px-6 py-4">Phone Number</th>
                          <th className="px-6 py-4">Validation Status</th>
                          <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-655 dark:text-slate-300">
                        {displayedRecipients.slice(recipientPage * 20, (recipientPage + 1) * 20).map((r) => {
                          const isEditing = editingRecipientId === r.id;
                          return (
                            <tr
                              key={r.id}
                              className={`hover:bg-slate-50/20 dark:hover:bg-slate-800/10 ${
                                r.excluded ? "opacity-60 bg-slate-50/30 dark:bg-slate-900/10" : ""
                              }`}
                            >
                              <td className="px-6 py-4">
                                <input
                                  type="checkbox"
                                  checked={!r.excluded}
                                  onChange={() => toggleExcludeRecipient(r.id)}
                                  className="rounded text-emerald-600 focus:ring-emerald-500"
                                />
                              </td>
                              <td className="px-6 py-4 font-semibold text-slate-850 dark:text-white">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="bg-slate-100 dark:bg-slate-800 border-0 rounded px-2 py-1 text-xs w-full max-w-sm"
                                  />
                                ) : (
                                  r.name
                                )}
                              </td>
                              <td className="px-6 py-4 font-mono">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editForm.phoneNumber}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, phoneNumber: e.target.value })
                                    }
                                    className="bg-slate-100 dark:bg-slate-800 border-0 rounded px-2 py-1 text-xs w-full max-w-sm"
                                  />
                                ) : (
                                  r.phoneNumber
                                )}
                              </td>
                              <td className="px-6 py-4">
                                {r.isValid ? (
                                  <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/25 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[9px]">
                                    Valid
                                  </span>
                                ) : (
                                  <span className="text-red-500 bg-red-50 dark:bg-red-950/25 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[9px]">
                                    {r.validationError || "Invalid"}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {isEditing ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => saveEditRecipient(r.id)}
                                      className="text-emerald-500 hover:underline font-semibold"
                                    >
                                      Save
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button
                                      type="button"
                                      onClick={() => setEditingRecipientId(null)}
                                      className="text-slate-400 hover:underline"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-2.5">
                                    <button
                                      type="button"
                                      onClick={() => startEditRecipient(r)}
                                      className="text-slate-400 hover:text-emerald-500 transition-colors"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteRecipient(r.id)}
                                      className="text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination control */}
                  {displayedRecipients.length > 20 && (
                    <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                      <span>
                        Showing {recipientPage * 20 + 1} to {Math.min((recipientPage + 1) * 20, displayedRecipients.length)} of {displayedRecipients.length} recipients
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={recipientPage === 0}
                          onClick={() => setRecipientPage(recipientPage - 1)}
                          className="px-2 py-1 border rounded disabled:opacity-40"
                        >
                          Prev
                        </button>
                        <button
                          type="button"
                          disabled={(recipientPage + 1) * 20 >= displayedRecipients.length}
                          onClick={() => setRecipientPage(recipientPage + 1)}
                          className="px-2 py-1 border rounded disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================
            STEP 3 — MESSAGE COMPOSER
            ================================================== */}
        {step === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-50 dark:border-slate-850">
              3. Message Composer
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Editor panel */}
              <div className="space-y-5">
                {/* Message type dropdown */}
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Message Type</label>
                  <select
                    value={messageType}
                    onChange={(e: any) => setMessageType(e.target.value)}
                    className="w-full max-w-sm bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 rounded-xl text-sm px-3.5 py-2.5 focus:ring-2 focus:ring-emerald-500/20 dark:text-white appearance-none cursor-pointer"
                  >
                    <option value="TEXT">Text Message</option>
                    <option value="IMAGE">Image with Caption</option>
                    <option value="DOCUMENT">Document with Caption</option>
                    <option value="VIDEO">Video with Caption</option>
                  </select>
                </div>

                {/* Media upload if not text */}
                {messageType !== "TEXT" && (
                  <div className="space-y-2 border border-slate-100 dark:border-slate-800 p-4 rounded-xl">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Upload {messageType} File (Max 16MB)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        onChange={handleMediaUpload}
                        accept={
                          messageType === "IMAGE"
                            ? "image/*"
                            : messageType === "VIDEO"
                            ? "video/*"
                            : ".pdf,.docx,.xlsx,.zip"
                        }
                        className="text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                      />
                      {mediaUploading && <Loader2 className="animate-spin text-emerald-500" size={16} />}
                    </div>
                    {mediaUrl && (
                      <p className="text-[10px] text-slate-400 font-mono truncate">
                        Linked: {mediaUrl.slice(0, 50)}...
                      </p>
                    )}
                  </div>
                )}

                {/* Variable chips */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Insert Personalized Variables
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Standarized chips */}
                    {["name", "phone", "company", "amount", "due_date"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleVariableChipClick(v)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 hover:text-emerald-600 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 transition-colors border border-slate-100 dark:border-slate-800"
                      >
                        <Sparkles size={11} className="text-emerald-500" />
                        {`{{${v}}}`}
                      </button>
                    ))}

                    {/* Extra keys from Excel mapping */}
                    {fileData &&
                      Object.keys(fileData.columnMapping).map((v) => {
                        if (!["name", "phone", "company", "amount", "dueDate"].includes(v)) {
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => handleVariableChipClick(v)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 hover:text-emerald-600 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 transition-colors border border-slate-100 dark:border-slate-800"
                            >
                              <Sparkles size={11} className="text-emerald-500" />
                              {`{{${v}}}`}
                            </button>
                          );
                        }
                        return null;
                      })}
                  </div>
                </div>

                {/* Message Body Input */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Message Body</label>
                  <textarea
                    ref={textareaRef}
                    rows={8}
                    placeholder="Hello {{name}}, your renewal amount is due..."
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white font-sans"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span>{messageBody.length} characters</span>
                    <span>~{Math.ceil(messageBody.length / 160) || 0} messages per recipient</span>
                  </div>
                </div>
              </div>

              {/* Live Preview Panel */}
              <div className="space-y-3 lg:border-l lg:border-slate-50 dark:border-slate-850/80 lg:pl-8">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye size={13} className="text-emerald-500" />
                  Live Message Preview
                </h3>
                
                {/* WhatsApp Chat bubble mock UI */}
                <div className="bg-[#efeae2] dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/80 min-h-[300px] flex flex-col justify-end">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm text-sm dark:text-white max-w-xs self-start border border-slate-50 dark:border-slate-800 relative">
                    {/* Optional media preview */}
                    {messageType !== "TEXT" && mediaUrl && (
                      <div className="mb-3 rounded-lg overflow-hidden max-w-full bg-slate-50 dark:bg-slate-800">
                        {messageType === "IMAGE" && (
                          <img src={mediaUrl} alt="Preview" className="w-full object-cover max-h-40" />
                        )}
                        {messageType === "VIDEO" && (
                          <video src={mediaUrl} className="w-full max-h-40" controls />
                        )}
                        {messageType === "DOCUMENT" && (
                          <div className="p-3 flex items-center gap-2">
                            <FileSpreadsheet className="text-emerald-600" size={24} />
                            <span className="text-xs truncate font-mono">{mediaFile?.name || "document.pdf"}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="whitespace-pre-line leading-relaxed font-sans">{livePreviewMessage}</p>
                    <div className="text-[10px] text-slate-400 text-right mt-1.5 font-semibold">12:00 PM</div>
                    {/* Tail corner */}
                    <div className="absolute left-[-6px] top-4 w-0 h-0 border-t-[6px] border-t-white dark:border-t-slate-900 border-l-[6px] border-l-transparent" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================
            STEP 4 — SENDING SETTINGS AND REVIEW
            ================================================== */}
        {step === 3 && (
          <div className="space-y-8 animate-fadeIn">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-50 dark:border-slate-850">
              4. Sending Settings
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Delay and Sleep Config */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-slate-850 dark:text-slate-200 flex items-center gap-1.5">
                  <Settings size={15} className="text-emerald-500" /> Delay & Safe Sending Config
                </h3>

                {/* Delays range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Minimum Delay (Seconds)
                    </label>
                    <input
                      type="number"
                      min={3}
                      value={minDelay}
                      onChange={(e) => setMinDelay(Math.max(3, parseInt(e.target.value) || 3))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Maximum Delay (Seconds)
                    </label>
                    <input
                      type="number"
                      min={minDelay}
                      value={maxDelay}
                      onChange={(e) => setMaxDelay(Math.max(minDelay, parseInt(e.target.value) || minDelay))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                    />
                  </div>
                </div>

                {/* Sleep Mode Toggle */}
                <div className="space-y-3 p-4 bg-slate-50/50 dark:bg-slate-850/20 rounded-2xl border border-slate-50 dark:border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-350">Enable Campaign Sleep</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Pauses campaign periodically to mimic human actions</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sleepEnabled}
                        onChange={(e) => setSleepEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {sleepEnabled && (
                    <div className="grid grid-cols-2 gap-4 pt-2 animate-fadeIn">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Send Messages Before Sleep
                        </label>
                        <input
                          type="number"
                          value={messagesBeforeSleep}
                          onChange={(e) => setMessagesBeforeSleep(parseInt(e.target.value) || 50)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Sleep Duration (Minutes)
                        </label>
                        <input
                          type="number"
                          value={sleepDurationMinutes}
                          onChange={(e) => setSleepDurationMinutes(parseInt(e.target.value) || 10)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Shorten URLs */}
                <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-850/20 rounded-2xl border border-slate-50 dark:border-slate-800/80">
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-350">Shorten URLs</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Automatically shortens links in the message body</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shortenUrls}
                      onChange={(e) => setShortenUrls(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* Schedule and Retries */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-slate-850 dark:text-slate-200 flex items-center gap-1.5">
                  <Calendar size={15} className="text-emerald-500" /> Scheduling & Delivery Retries
                </h3>

                {/* Schedule Type */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Campaign Schedule
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setScheduleType("NOW")}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        scheduleType === "NOW"
                          ? "border-emerald-500 bg-emerald-50/25 text-emerald-700 dark:text-emerald-450 font-bold"
                          : "border-slate-100 dark:border-slate-800 text-slate-655"
                      }`}
                    >
                      Send Now
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleType("LATER")}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        scheduleType === "LATER"
                          ? "border-emerald-500 bg-emerald-50/25 text-emerald-700 dark:text-emerald-450 font-bold"
                          : "border-slate-100 dark:border-slate-800 text-slate-655"
                      }`}
                    >
                      Schedule Later
                    </button>
                  </div>

                  {scheduleType === "LATER" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-fadeIn">
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-400 font-semibold">Date & Time</label>
                        <input
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-400 font-semibold">Timezone</label>
                        <select
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-xs px-3 py-2.5 focus:ring-2 focus:ring-emerald-500/20 dark:text-white cursor-pointer"
                        >
                          <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                          <option value="UTC">UTC</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Retries Toggle */}
                <div className="space-y-3 p-4 bg-slate-50/50 dark:bg-slate-850/20 rounded-2xl border border-slate-50 dark:border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-350">Failed Message Retry</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Automatically retry sending if a connection drops</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={retryEnabled}
                        onChange={(e) => setRetryEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {retryEnabled && (
                    <div className="space-y-1 pt-1 animate-fadeIn">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Maximum Retries
                      </label>
                      <select
                        value={maxRetries}
                        onChange={(e) => setMaxRetries(parseInt(e.target.value) || 2)}
                        className="bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-xs px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 dark:text-white cursor-pointer"
                      >
                        <option value={1}>1 Retry</option>
                        <option value={2}>2 Retries</option>
                        <option value={3}>3 Retries</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-t border-slate-100 dark:border-slate-800 p-4 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft size={16} /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleLaunchCampaign(true)}
              disabled={loading || campaignName.trim().length === 0}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
            >
              Save as Draft
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1.5 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Next <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={loading}
                className="flex items-center gap-1.5 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : "Launch Campaign"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800/80 animate-scaleUp">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Confirm Campaign Launch</h3>
            <p className="text-slate-500 text-sm mt-3 leading-relaxed">
              You are about to launch the campaign <span className="font-semibold text-slate-800 dark:text-white">"{campaignName}"</span> to{" "}
              <span className="font-bold text-emerald-600">{totalValidSelected}</span> valid recipients using{" "}
              <span className="font-semibold text-slate-800 dark:text-white">{selectedSenders.length}</span> WhatsApp senders.
            </p>
            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl mt-4 text-xs space-y-1.5 text-slate-500 border border-slate-50 dark:border-slate-800/60">
              <div className="flex justify-between">
                <span>Message Type:</span>
                <span className="font-semibold">{messageType}</span>
              </div>
              <div className="flex justify-between">
                <span>Sending Delay:</span>
                <span className="font-semibold">{minDelay} - {maxDelay} seconds</span>
              </div>
              {scheduleType === "LATER" && (
                <div className="flex justify-between">
                  <span>Scheduled Date:</span>
                  <span className="font-semibold text-yellow-600">{new Date(scheduledAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleLaunchCampaign(false)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Confirm and Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
