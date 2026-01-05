import pandas as pd

FILE = "C:\\Users\\admin\\Downloads\\archive(1)\\steam_reviews.csv"

def remove_outliers_by_steamid(df, outlier_ids):
    """
    #Remove rows where author.steamid matches any ID in outlier_ids.
    #outlier_ids should be a list or set of steamid strings/numbers.
    """
    return df[~df["author.steamid"].isin(outlier_ids)].copy()

OUTLIERS = [
     76561198848008157,
     76561198070649181,
     76561198127787009,
     76561198103272004
]