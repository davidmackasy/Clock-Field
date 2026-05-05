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
