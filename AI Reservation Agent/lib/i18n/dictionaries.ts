export type Locale = "en" | "ar";

export type Dictionary = {
  appName: string;
  signOut: string;
  languageSwitchTo: string;
  nav: Record<string, string>;
  login: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    submit: string;
    invalidCredentials: string;
    devCredentialsNote: string;
  };
  role: Record<string, string>;
  users: string;
  dashboard: {
    pageTitle: string;
    organization: string;
    properties: string;
    welcome: string;
    emptyTitle: string;
    emptyDescription: string;
  };
  admin: {
    pageTitle: string;
    organizations: string;
    emptyTitle: string;
    emptyDescription: string;
  };
  phaseComingSoon: string;
  backToHome: string;
  resort: {
    title: string;
    subtitle: string;
    propertyDetails: string;
    name: string;
    description: string;
    descriptionHint: string;
    address: string;
    mapsUrl: string;
    mapsUrlOptional: string;
    checkIn: string;
    checkOut: string;
    maxGuests: string;
    bedrooms: string;
    beds: string;
    bathrooms: string;
    deposit: string;
    depositHint: string;
    cancellationWindow: string;
    cancellationHint: string;
    minStay: string;
    sameDay: string;
    save: string;
    saving: string;
    saved: string;
    saveError: string;
    facilities: string;
    facilitiesHint: string;
    addFacility: string;
    facilityLabelEn: string;
    facilityLabelAr: string;
    facilityIcon: string;
    photos: string;
    photosHint: string;
    addPhoto: string;
    photoUrl: string;
    photoAlt: string;
    remove: string;
    cancel: string;
    add: string;
    update: string;
    noPropertyTitle: string;
    noPropertyHint: string;
    nights: string;
    ohmr: string;
  };
  kb: {
    title: string;
    subtitle: string;
    addEntry: string;
    type: string;
    question: string;
    contentEn: string;
    contentAr: string;
    active: string;
    inactive: string;
    save: string;
    cancel: string;
    edit: string;
    delete: string;
    confirmDelete: string;
    empty: string;
    emptyHint: string;
    types: Record<string, string>;
  };
  settings: {
    title: string;
    subtitle: string;
    comingSoon: string;
    comingSoonHint: string;
  };
  customers: {
    title: string;
    subtitle: string;
    add: string;
    name: string;
    phone: string;
    email: string;
    language: string;
    notes: string;
    reservations: string;
    search: string;
    noResults: string;
    confirmDelete: string;
    deleteError: string;
    duplicatePhone: string;
    saved: string;
    view: string;
    edit: string;
    delete: string;
    save: string;
    cancel: string;
    back: string;
    allCustomers: string;
    reservationCount: string;
  };
  reservations: {
    title: string;
    subtitle: string;
    new: string;
    guest: string;
    checkIn: string;
    checkOut: string;
    nights: string;
    guests: string;
    total: string;
    deposit: string;
    remaining: string;
    status: string;
    actions: string;
    filterStatus: string;
    allStatuses: string;
    search: string;
    noResults: string;
    detail: string;
    paymentHistory: string;
    markDepositPaid: string;
    cancel: string;
    cancelReason: string;
    cancelConfirm: string;
    depositRefundable: string;
    yes: string;
    no: string;
    editDates: string;
    saveChanges: string;
    recalculate: string;
    selectCustomer: string;
    selectDates: string;
    addNotes: string;
    source: string;
    createdAt: string;
    confirmed: string;
    paymentPending: string;
    cancelled: string;
    completed: string;
    prices: {
      perNight: string;
      breakdown: string;
      season: string;
      date: string;
    };
  };
  payments: {
    title: string;
    subtitle: string;
    comingSoon: string;
    comingSoonHint: string;
    type: string;
    amount: string;
    status: string;
    method: string;
    paidAt: string;
    verifiedBy: string;
    history: string;
  };
};

export const dictionaries: Record<Locale, Dictionary> = {
  en: {
    appName: "Queens Garden AI",
    signOut: "Sign out",
    languageSwitchTo: "العربية",
    nav: {
      dashboard: "Dashboard",
      calendar: "Calendar",
      reservations: "Reservations",
      customers: "Customers",
      aiChat: "AI Chat",
      pricing: "Pricing",
      payments: "Payments",
      resortInfo: "Resort Information",
      settings: "Settings",
      organizations: "Organizations",
      properties: "Properties",
      aiConfig: "AI Configuration",
      integrations: "Integrations",
      systemHealth: "System Health",
      logs: "Logs",
    },
    login: {
      title: "Welcome back",
      subtitle: "Sign in to your workspace",
      email: "Email",
      password: "Password",
      submit: "Sign in",
      invalidCredentials: "Invalid email or password.",
      devCredentialsNote:
        "Dev accounts: aflah@queensgarden.ai (admin) · owner@queensgarden.ai (owner)",
    },
    role: {
      PLATFORM_ADMIN: "Platform Admin",
      ORG_OWNER: "Resort Owner",
      ORG_STAFF: "Resort Staff",
    },
    users: "users",
    dashboard: {
      pageTitle: "Dashboard",
      organization: "Organization",
      properties: "Properties",
      welcome: "Welcome",
      emptyTitle: "You're all set up",
      emptyDescription:
        "Calendar, reservations, and the AI agent arrive in the next phases. This dashboard stays scoped to your organization only.",
    },
    admin: {
      pageTitle: "Platform Admin",
      organizations: "Organizations",
      emptyTitle: "No organizations yet",
      emptyDescription:
        "Organizations, properties, and AI configuration arrive in the next phases.",
    },
    phaseComingSoon: "Coming in Phase {phase}",
    backToHome: "Back to home",
    resort: {
      title: "Resort Information",
      subtitle:
        "This is what guests and the AI assistant know about your resort. Changes save instantly to your website assistant.",
      propertyDetails: "Property details",
      name: "Resort name",
      description: "Description",
      descriptionHint: "A short, friendly summary guests see about your resort.",
      address: "Location / Address",
      mapsUrl: "Google Maps link",
      mapsUrlOptional: "Optional",
      checkIn: "Check-in time",
      checkOut: "Check-out time",
      maxGuests: "Maximum guests",
      bedrooms: "Bedrooms",
      beds: "Beds",
      bathrooms: "Bathrooms",
      deposit: "Deposit required (OMR)",
      depositHint: "Amount guests pay to confirm a booking.",
      cancellationWindow: "Free cancellation up to (days before check-in)",
      cancellationHint: "Cancellations within this window are non-refundable.",
      minStay: "Minimum stay (nights)",
      sameDay: "Allow same-day bookings",
      save: "Save changes",
      saving: "Saving…",
      saved: "Saved ✓",
      saveError: "Please fix the highlighted fields and try again.",
      facilities: "Facilities & amenities",
      facilitiesHint: "Click add to include a facility. Each facility needs an English and Arabic name.",
      addFacility: "Add facility",
      facilityLabelEn: "Name (English)",
      facilityLabelAr: "Name (Arabic)",
      facilityIcon: "Icon",
      photos: "Photos",
      photosHint: "Paste image links to display photos of your resort.",
      addPhoto: "Add photo",
      photoUrl: "Image link",
      photoAlt: "Caption (optional)",
      remove: "Remove",
      cancel: "Cancel",
      add: "Add",
      update: "Save",
      noPropertyTitle: "No resort set up yet",
      noPropertyHint: "Ask the platform admin to add your resort property first.",
      nights: "nights",
      ohmr: "OMR",
    },
    kb: {
      title: "Questions & answers (what the AI knows)",
      subtitle:
        "Add the facts, policies, and FAQs you want guests and the AI to know — in English and Arabic.",
      addEntry: "Add entry",
      type: "Type",
      question: "Question",
      contentEn: "Answer (English)",
      contentAr: "Answer (Arabic)",
      active: "Visible to guests & AI",
      inactive: "Hidden",
      save: "Save",
      cancel: "Cancel",
      edit: "Edit",
      delete: "Delete",
      confirmDelete: "Confirm delete?",
      empty: "No entries yet",
      emptyHint: "Add FAQs, policies, and location info so the AI can answer guests correctly.",
      types: {
        FACILITY: "Facility",
        POLICY: "Policy",
        FAQ: "FAQ",
        LOCATION: "Location",
        CONTACT: "Contact",
        OTHER: "Other",
      },
    },
    settings: {
      title: "Settings",
      subtitle: "Language, notifications, and account preferences.",
      comingSoon: "Settings are coming soon",
      comingSoonHint:
        "Basic settings arrive in a later phase. Everything here is optional for now.",
    },
    customers: {
      title: "Customers",
      subtitle: "Manage your guest directory and reservation history.",
      add: "Add customer",
      name: "Name",
      phone: "Phone",
      email: "Email",
      language: "Preferred language",
      notes: "Notes",
      reservations: "Reservations",
      search: "Search by name or phone…",
      noResults: "No customers found",
      confirmDelete: "Delete this customer?",
      deleteError: "Cannot delete — customer has reservations",
      duplicatePhone: "A customer with this phone already exists",
      saved: "Customer saved",
      view: "View",
      edit: "Edit",
      delete: "Delete",
      save: "Save",
      cancel: "Cancel",
      back: "Back",
      allCustomers: "All customers",
      reservationCount: "{count} reservations",
    },
    reservations: {
      title: "Reservations",
      subtitle: "Create, edit, and manage bookings for your resort.",
      new: "New reservation",
      guest: "Guest",
      checkIn: "Check-in",
      checkOut: "Check-out",
      nights: "Nights",
      guests: "Guests",
      total: "Total",
      deposit: "Deposit",
      remaining: "Remaining",
      status: "Status",
      actions: "Actions",
      filterStatus: "Filter by status",
      allStatuses: "All statuses",
      search: "Search guest name or phone…",
      noResults: "No reservations found",
      detail: "Reservation detail",
      paymentHistory: "Payment history",
      markDepositPaid: "Mark deposit paid",
      cancel: "Cancel reservation",
      cancelReason: "Cancellation reason (optional)",
      cancelConfirm: "Are you sure you want to cancel this reservation?",
      depositRefundable: "Deposit refundable",
      yes: "Yes",
      no: "No",
      editDates: "Edit dates & guests",
      saveChanges: "Save changes",
      recalculate: "Recalculate price",
      selectCustomer: "Select a customer",
      selectDates: "Select dates",
      addNotes: "Notes (optional)",
      source: "Source",
      createdAt: "Created",
      confirmed: "Confirmed",
      paymentPending: "Pending Payment",
      cancelled: "Cancelled",
      completed: "Completed",
      prices: {
        perNight: "per night",
        breakdown: "Price breakdown",
        season: "Season",
        date: "Date",
      },
    },
    payments: {
      title: "Payments",
      subtitle: "Payment tracking and provider integrations.",
      comingSoon: "Payment integrations coming soon",
      comingSoonHint: "Manual deposit marking is available on the Reservations page. Online payment providers will be configured here in a later phase.",
      type: "Type",
      amount: "Amount",
      status: "Status",
      method: "Method",
      paidAt: "Paid at",
      verifiedBy: "Verified by",
      history: "Payment history",
    },
  },
  ar: {
    appName: "Queens Garden AI",
    signOut: "تسجيل الخروج",
    languageSwitchTo: "English",
    nav: {
      dashboard: "لوحة التحكم",
      calendar: "التقويم",
      reservations: "الحجوزات",
      customers: "العملاء",
      aiChat: "محادثة الذكاء الاصطناعي",
      pricing: "التسعير",
      payments: "المدفوعات",
      resortInfo: "معلومات المنتجع",
      settings: "الإعدادات",
      organizations: "المؤسسات",
      properties: "العقارات",
      aiConfig: "إعدادات الذكاء الاصطناعي",
      integrations: "التكاملات",
      systemHealth: "صحة النظام",
      logs: "السجلات",
    },
    login: {
      title: "مرحباً بعودتك",
      subtitle: "سجّل الدخول إلى مساحة العمل",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      submit: "تسجيل الدخول",
      invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      devCredentialsNote:
        "حسابات التطوير: aflah@queensgarden.ai (مدير المنصة) · owner@queensgarden.ai (مالك المنتجع)",
    },
    role: {
      PLATFORM_ADMIN: "مدير المنصة",
      ORG_OWNER: "مالك المنتجع",
      ORG_STAFF: "موظف المنتجع",
    },
    users: "مستخدمون",
    dashboard: {
      pageTitle: "لوحة التحكم",
      organization: "المؤسسة",
      properties: "العقارات",
      welcome: "مرحباً",
      emptyTitle: "كل شيء جاهز",
      emptyDescription:
        "التقويم والحجوزات والوكيل الذكي ستُضاف في المراحل القادمة. تظل لوحة التحكم هذه مقتصرة على مؤسستك فقط.",
    },
    admin: {
      pageTitle: "مدير المنصة",
      organizations: "المؤسسات",
      emptyTitle: "لا توجد مؤسسات بعد",
      emptyDescription:
        "المؤسسات والعقارات وإعدادات الذكاء الاصطناعي ستُضاف في المراحل القادمة.",
    },
    phaseComingSoon: "قريباً في المرحلة {phase}",
    backToHome: "العودة إلى الرئيسية",
    resort: {
      title: "معلومات المنتجع",
      subtitle:
        "هذه هي المعلومات التي يعرفها الضيوف والمساعد الذكي عن منتجعك. التغييرات تُحفظ فوراً لمساعد الموقع.",
      propertyDetails: "تفاصيل المنتجع",
      name: "اسم المنتجع",
      description: "الوصف",
      descriptionHint: "ملخص قصير وودّي يراه الضيوف عن منتجعك.",
      address: "الموقع / العنوان",
      mapsUrl: "رابط خرائط جوجل",
      mapsUrlOptional: "اختياري",
      checkIn: "وقت تسجيل الوصول",
      checkOut: "وقت تسجيل المغادرة",
      maxGuests: "الحد الأقصى للضيوف",
      bedrooms: "غرف النوم",
      beds: "الأسرة",
      bathrooms: "الحمامات",
      deposit: "العربون المطلوب (ريال عماني)",
      depositHint: "المبلغ الذي يدفعه الضيوف لتأكيد الحجز.",
      cancellationWindow: "الإلغاء المجاني حتى (أيام قبل الوصول)",
      cancellationHint: "الإلغاء خلال هذه المدة غير مسترد.",
      minStay: "الحد الأدنى للإقامة (ليالٍ)",
      sameDay: "السماح بالحجوزات في نفس اليوم",
      save: "حفظ التغييرات",
      saving: "جارٍ الحفظ…",
      saved: "تم الحفظ ✓",
      saveError: "يرجى تصحيح الحقول المميزة ثم المحاولة مرة أخرى.",
      facilities: "المرافق والخدمات",
      facilitiesHint: "اضغط إضافة لتضمين مرفق. كل مرفق يحتاج اسماً بالإنجليزية والعربية.",
      addFacility: "إضافة مرفق",
      facilityLabelEn: "الاسم (الإنجليزية)",
      facilityLabelAr: "الاسم (العربية)",
      facilityIcon: "الأيقونة",
      photos: "الصور",
      photosHint: "الصق روابط الصور لعرض صور منتجعك.",
      addPhoto: "إضافة صورة",
      photoUrl: "رابط الصورة",
      photoAlt: "التسمية التوضيحية (اختياري)",
      remove: "إزالة",
      cancel: "إلغاء",
      add: "إضافة",
      update: "حفظ",
      noPropertyTitle: "لم يتم إعداد منتجع بعد",
      noPropertyHint: "اطلب من مدير المنصة إضافة منتجعك أولاً.",
      nights: "ليالٍ",
      ohmr: "ر.ع.",
    },
    kb: {
      title: "الأسئلة والأجوبة (ما يعرفه الذكاء الاصطناعي)",
      subtitle:
        "أضف الحقائق والسياسات والأسئلة الشائعة التي تريد أن يعرفها الضيوف والذكاء الاصطناعي — بالإنجليزية والعربية.",
      addEntry: "إضافة عنصر",
      type: "النوع",
      question: "السؤال",
      contentEn: "الإجابة (الإنجليزية)",
      contentAr: "الإجابة (العربية)",
      active: "مرئي للضيوف والذكاء الاصطناعي",
      inactive: "مخفي",
      save: "حفظ",
      cancel: "إلغاء",
      edit: "تعديل",
      delete: "حذف",
      confirmDelete: "تأكيد الحذف؟",
      empty: "لا توجد عناصر بعد",
      emptyHint: "أضف الأسئلة الشائعة والسياسات ومعلومات الموقع حتى يتمكن الذكاء الاصطناعي من الإجابة على الضيوف بشكل صحيح.",
      types: {
        FACILITY: "مرفق",
        POLICY: "سياسة",
        FAQ: "سؤال شائع",
        LOCATION: "الموقع",
        CONTACT: "اتصال",
        OTHER: "أخرى",
      },
    },
    settings: {
      title: "الإعدادات",
      subtitle: "اللغة والإشعارات وتفضيلات الحساب.",
      comingSoon: "الإعدادات قادمة قريباً",
      comingSoonHint: "الإعدادات الأساسية ستُضاف في مرحلة لاحقة. كل شيء هنا اختياري حالياً.",
    },
    customers: {
      title: "العملاء",
      subtitle: "إدارة دليل الضيوف وسجل الحجوزات.",
      add: "إضافة عميل",
      name: "الاسم",
      phone: "الهاتف",
      email: "البريد الإلكتروني",
      language: "اللغة المفضلة",
      notes: "ملاحظات",
      reservations: "الحجوزات",
      search: "بحث بالاسم أو الهاتف…",
      noResults: "لم يتم العثور على عملاء",
      confirmDelete: "حذف هذا العميل؟",
      deleteError: "لا يمكن الحذف — لدى العميل حجوزات",
      duplicatePhone: "يوجد عميل بهذا الرقم مسبقاً",
      saved: "تم حفظ العميل",
      view: "عرض",
      edit: "تعديل",
      delete: "حذف",
      save: "حفظ",
      cancel: "إلغاء",
      back: "رجوع",
      allCustomers: "جميع العملاء",
      reservationCount: "{count} حجوزات",
    },
    reservations: {
      title: "الحجوزات",
      subtitle: "إنشاء وتعديل وإدارة حجوزات منتجعك.",
      new: "حجز جديد",
      guest: "الضيف",
      checkIn: "تسجيل الوصول",
      checkOut: "تسجيل المغادرة",
      nights: "ليالٍ",
      guests: "الضيوف",
      total: "الإجمالي",
      deposit: "العربون",
      remaining: "المتبقي",
      status: "الحالة",
      actions: "الإجراءات",
      filterStatus: "تصفية حسب الحالة",
      allStatuses: "جميع الحالات",
      search: "بحث باسم الضيف أو الهاتف…",
      noResults: "لم يتم العثور على حجوزات",
      detail: "تفاصيل الحجز",
      paymentHistory: "سجل المدفوعات",
      markDepositPaid: "تحديد العربون كمدفوع",
      cancel: "إلغاء الحجز",
      cancelReason: "سبب الإلغاء (اختياري)",
      cancelConfirm: "هل أنت متأكد من إلغاء هذا الحجز؟",
      depositRefundable: "ال العربون مسترد",
      yes: "نعم",
      no: "لا",
      editDates: "تعديل التواريخ والضيوف",
      saveChanges: "حفظ التغييرات",
      recalculate: "إعادة حساب السعر",
      selectCustomer: "اختر عميلاً",
      selectDates: "اختر التواريخ",
      addNotes: "ملاحظات (اختياري)",
      source: "المصدر",
      createdAt: "أنشئ في",
      confirmed: "مؤكد",
      paymentPending: "بانتظار الدفع",
      cancelled: "ملغى",
      completed: "مكتمل",
      prices: {
        perNight: "لليلة الواحدة",
        breakdown: "تفاصيل السعر",
        season: "الموسم",
        date: "التاريخ",
      },
    },
    payments: {
      title: "المدفوعات",
      subtitle: "تتبع المدفوعات وتكاملات مزودي الدفع.",
      comingSoon: "تكاملات الدفع قادمة قريباً",
      comingSoonHint: "تحديد العربون يدوياً متاح من صفحة الحجوزات. مزودو الدفع عبر الإنترنت سيتم إعدادهم هنا في مرحلة لاحقة.",
      type: "النوع",
      amount: "المبلغ",
      status: "الحالة",
      method: "الطريقة",
      paidAt: "تاريخ الدفع",
      verifiedBy: "تحقق بواسطة",
      history: "سجل المدفوعات",
    },
  },
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
