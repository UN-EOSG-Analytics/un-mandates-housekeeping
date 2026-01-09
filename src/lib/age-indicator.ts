const currentYear = new Date().getFullYear();

export interface AgeIndicator {
  color: string;
  bgColor: string;
  label: string;
  tooltip: string;
}

export function getAgeIndicator(year: number | null): AgeIndicator {
  if (!year)
    return {
      color: "text-gray-400",
      bgColor: "bg-gray-100",
      label: "—",
      tooltip: "Year unknown",
    };

  const age = currentYear - year;

  if (age < 5) {
    return {
      color: "text-green-600",
      bgColor: "bg-green-100",
      label: "<5",
      tooltip: `${age} year${age !== 1 ? "s" : ""} old`,
    };
  } else if (age < 10) {
    return {
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
      label: ">5",
      tooltip: `${age} years old`,
    };
  } else if (age < 20) {
    return {
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      label: ">10",
      tooltip: `${age} years old`,
    };
  } else if (age < 50) {
    return {
      color: "text-red-600",
      bgColor: "bg-red-100",
      label: ">20",
      tooltip: `${age} years old`,
    };
  } else {
    return {
      color: "text-red-800",
      bgColor: "bg-red-200",
      label: ">50",
      tooltip: `${age} years old`,
    };
  }
}

