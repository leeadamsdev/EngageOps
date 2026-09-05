namespace EngageOps.Api.DevelopmentData;

internal static class DevelopmentDataCatalog
{
    public static IReadOnlyList<DevelopmentOrganisationData> Organisations { get; } =
    [
        new("Northstar Demo Workforce",
        [
            .. new[]
                {
                    "Alderbrook",
                    "Beacon",
                    "Cedar",
                    "Delta",
                    "Elmbridge",
                    "Frontier",
                    "Granite",
                    "Harbour",
                    "Meridian",
                }
                .SelectMany(prefix => new[]
                {
                    $"{prefix} Advisory",
                    $"{prefix} Facilities",
                    $"{prefix} Logistics",
                    $"{prefix} Operations",
                    $"{prefix} Services",
                }),
        ],
        [
            "Aaron Brooks",
            "Aisha Rahman",
            "Alex Morgan",
            "Amelia Clarke",
            "Ben Carter",
            "Bethany Green",
            "Callum Fraser",
            "Chloe Bennett",
            "Daniel Hughes",
            "Deepa Shah",
            "Dylan Evans",
            "Elena Rossi",
            "Emily Parker",
            "Ethan Walker",
            "Fatima Ali",
            "Felix Turner",
            "Grace Wilson",
            "Hannah Reed",
            "Hassan Ahmed",
            "Isabel Martin",
            "Jack Thompson",
            "Jamie Collins",
            "Jasmine Patel",
            "Jordan Blake",
            "Joshua Wright",
            "Katie Robinson",
            "Liam Murphy",
            "Lily Foster",
            "Lucas Brown",
            "Maya Desai",
            "Megan Lewis",
            "Nathan Cooper",
            "Niamh Kelly",
            "Noah Davies",
            "Oliver Scott",
            "Priya Mehta",
            "Rachel Adams",
            "Ryan Mitchell",
            "Sam Taylor",
            "Sophie Wood",
            "Taylor James",
            "Thomas Hall",
            "Victoria King",
            "William Young",
            "Zoe Carter",
        ]),
        new("Cedar Demo Workforce",
        [
            "Bramble Consulting",
            "Cobalt Engineering",
            "Willow Healthcare",
        ],
        [
            "Emma Lawson",
            "Marcus Bell",
            "Sofia Costa",
        ]),
        new("Newhaven Demo Workforce", [], []),
    ];
}

internal sealed record DevelopmentOrganisationData(
    string Name,
    IReadOnlyList<string> ClientNames,
    IReadOnlyList<string> WorkerNames);
