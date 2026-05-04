import {
  Home, Calendar, User, FolderOpen, FileText, NotebookPen, ClipboardList,
  MessageSquare, AlertTriangle, Package, HelpCircle, Camera, CalendarClock, DollarSign,
} from "lucide-react";

export const employeeNavItems = [
  { label: "Home",     href: "/employee",          icon: Home },
  { label: "Schedule", href: "/employee/schedule",  icon: Calendar },
  { label: "Messages", href: "/employee/messages",  icon: MessageSquare },
  { label: "Profile",  href: "/employee/profile",   icon: User },
];

export const employeeCenterAction = {
  label: "Action",
  actionSheet: {
    title: "Choose Action",
    options: [
      {
        label: "New Message",
        description: "Send a message to your admin or team",
        icon: MessageSquare,
        href: "/employee/messages?compose=general_message",
      },
      {
        label: "Report Incident",
        description: "Report a workplace incident or safety issue",
        icon: AlertTriangle,
        href: "/employee/messages?compose=incident_report",
      },
      {
        label: "Report Cleaning Issue",
        description: "Flag a cleaning concern or quality issue",
        icon: FolderOpen,
        href: "/employee/messages?compose=cleaning_issue",
      },
      {
        label: "Request Supplies",
        description: "Request cleaning supplies or equipment",
        icon: Package,
        href: "/employee/messages?compose=supply_request",
      },
      {
        label: "Schedule Question",
        description: "Ask about your shifts or schedule",
        icon: CalendarClock,
        href: "/employee/messages?compose=schedule_question",
      },
      {
        label: "Payroll Question",
        description: "Ask about pay, hours, or deductions",
        icon: DollarSign,
        href: "/employee/messages?compose=payroll_question",
      },
      {
        label: "Upload Photos",
        description: "Send photos from your current location",
        icon: Camera,
        href: "/employee/messages?compose=photo_report",
      },
      {
        label: "Start Work",
        description: "Continue with the regular work submission flow",
        icon: FileText,
        href: "/employee/work-log",
      },
      {
        label: "Field Note",
        description: "Record voice and photos for a site note or walkthrough",
        icon: NotebookPen,
        href: "/employee/field-notes",
      },
      {
        label: "Scheduled Notes",
        description: "Complete your daily photo checklists",
        icon: ClipboardList,
        href: "/employee/scheduled-field-notes",
      },
    ],
  },
};

export const clientNavItems = [
  { label: "Home",     href: "/client",           icon: Home },
  { label: "Messages", href: "/client/messages",   icon: MessageSquare },
  { label: "Profile",  href: "/client/profile",    icon: User },
];

export const clientCenterAction = {
  label: "Action",
  actionSheet: {
    title: "What would you like to do?",
    options: [
      {
        label: "Send Message",
        description: "Start a new conversation with your service team",
        icon: MessageSquare,
        href: "/client/messages?compose=general_message",
      },
      {
        label: "Report Cleaning Issue",
        description: "Flag a cleaning concern or quality problem",
        icon: AlertTriangle,
        href: "/client/messages?compose=cleaning_issue",
      },
      {
        label: "Request Service",
        description: "Request a cleaning or additional service",
        icon: FolderOpen,
        href: "/client/messages?compose=client_request",
      },
      {
        label: "Upload Photos",
        description: "Send photos of an issue or your space",
        icon: Camera,
        href: "/client/messages?compose=photo_report",
      },
      {
        label: "Maintenance Concern",
        description: "Report a maintenance or facility issue",
        icon: HelpCircle,
        href: "/client/messages?compose=maintenance_issue",
      },
    ],
  },
};
